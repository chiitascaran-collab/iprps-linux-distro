#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Fine-tunes Llama 3.1 Nemotron Nano 4B on the IPRPS training data with Unsloth (LoRA),
then exports GGUF files that load in IPRPS Model Loader, llama.cpp, LM Studio or Ollama.

Quick start (NVIDIA GPU with 8 GB+ VRAM; Linux, WSL2, or Windows with Unsloth installed):
    pip install unsloth
    python train_iprps.py --data "D:/Infinite Plane Role Playing System/AI Training Files/Training JSONL"

Second round, continuing from the saved adapter (mix old and new examples in the JSONL first):
    python train_iprps.py --data <folder> --continue-from runs/iprps-v1/lora --epochs 1 --run-name iprps-v2

Outputs (in runs/<run-name>/):
    lora/            the LoRA adapter (small; use it to continue training later)
    gguf/            *.Q4_K_M.gguf and *.Q8_0.gguf with the IPRPS chat template built in
    training_log.json  loss curve and final eval loss
"""
import argparse, inspect, json, os, sys, time

# Same Llama 3 template the GGUF fix script installs, so training and chatting match exactly.
# When no system message is given it falls back to the IPRPS Session Master prompt used in training.
SYSTEM = ("You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) "
          "by Mythical Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, "
          "campaign patches and rules accurately, completely and in their intended tone.")
CHAT_TEMPLATE = (
    "{{- bos_token -}}"
    "{%- if messages[0]['role'] == 'system' -%}{%- set system = messages[0]['content'] -%}{%- set loop_messages = messages[1:] -%}"
    "{%- else -%}{%- set system = '" + SYSTEM + "' -%}{%- set loop_messages = messages -%}{%- endif -%}"
    "{{- '<|start_header_id|>system<|end_header_id|>\n\n' + system + '<|eot_id|>' -}}"
    "{%- for message in loop_messages -%}"
    "{{- '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] + '<|eot_id|>' -}}"
    "{%- endfor -%}"
    "{%- if add_generation_prompt -%}{{- '<|start_header_id|>assistant<|end_header_id|>\n\n' -}}{%- endif -%}"
)
USER_PART = "<|start_header_id|>user<|end_header_id|>\n\n"
ASSISTANT_PART = "<|start_header_id|>assistant<|end_header_id|>\n\n"


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", required=True, help="folder with iprps_train.jsonl and iprps_eval.jsonl")
    p.add_argument("--base-model", default="nvidia/Llama-3.1-Nemotron-Nano-4B-v1.1")
    p.add_argument("--continue-from", default="", help="a saved LoRA adapter folder to keep training")
    p.add_argument("--run-name", default="iprps-v1")
    p.add_argument("--out", default="runs")
    p.add_argument("--epochs", type=float, default=3)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--rank", type=int, default=32)
    p.add_argument("--alpha", type=int, default=32)
    p.add_argument("--max-seq-len", type=int, default=4096)
    p.add_argument("--batch-size", type=int, default=2)
    p.add_argument("--grad-accum", type=int, default=4, help="effective batch = batch-size × grad-accum")
    p.add_argument("--eval-every", type=int, default=100, help="steps between eval-loss checks")
    p.add_argument("--patience", type=int, default=3, help="stop after this many evals without improvement (0 = off)")
    p.add_argument("--quants", default="q4_k_m,q8_0", help="GGUF quantizations to export ('' to skip)")
    p.add_argument("--no-4bit", action="store_true", help="load in 16-bit (needs much more VRAM)")
    p.add_argument("--seed", type=int, default=3407)
    return p.parse_args()


def kwargs_for(cls, **kw):
    """Pass only the arguments this library version accepts (TRL/transformers rename things between releases)."""
    names = set(inspect.signature(cls.__init__).parameters)
    out = {}
    for k, v in kw.items():
        for alias in k.split("|"):
            if alias in names:
                out[alias] = v
                break
    return out


def main():
    a = parse_args()
    run_dir = os.path.join(a.out, a.run_name)
    os.makedirs(run_dir, exist_ok=True)

    from unsloth import FastLanguageModel  # import unsloth before transformers/trl
    from unsloth.chat_templates import train_on_responses_only
    import torch
    from datasets import load_dataset
    from transformers import EarlyStoppingCallback
    from trl import SFTConfig, SFTTrainer

    # ---- model + tokenizer
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=a.continue_from or a.base_model, max_seq_length=a.max_seq_len,
        load_in_4bit=not a.no_4bit, dtype=None)
    tokenizer.chat_template = CHAT_TEMPLATE
    if tokenizer.pad_token is None or tokenizer.pad_token == tokenizer.eos_token:
        tokenizer.pad_token = "<|finetune_right_pad_id|>" if "<|finetune_right_pad_id|>" in tokenizer.get_vocab() else tokenizer.eos_token

    if not a.continue_from:
        model = FastLanguageModel.get_peft_model(
            model, r=a.rank, lora_alpha=a.alpha, lora_dropout=0, bias="none",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            use_gradient_checkpointing="unsloth", random_state=a.seed)

    # ---- data
    files = {"train": os.path.join(a.data, "iprps_train.jsonl"), "eval": os.path.join(a.data, "iprps_eval.jsonl")}
    ds = load_dataset("json", data_files=files)
    bos = tokenizer.bos_token or ""

    def to_text(batch):
        texts = []
        for msgs in batch["messages"]:
            t = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)
            texts.append(t[len(bos):] if bos and t.startswith(bos) else t)  # the trainer adds BOS itself
        return {"text": texts}

    ds = ds.map(to_text, batched=True, remove_columns=ds["train"].column_names)
    print(f"Train examples: {len(ds['train'])} · eval examples: {len(ds['eval'])}")
    print("Sample:\n" + ds["train"][0]["text"][:600] + "\n…")

    # ---- training
    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    cfg = SFTConfig(**kwargs_for(SFTConfig,
        output_dir=os.path.join(run_dir, "checkpoints"),
        dataset_text_field="text", **{"max_length|max_seq_length": a.max_seq_len}, packing=False,
        per_device_train_batch_size=a.batch_size, per_device_eval_batch_size=a.batch_size,
        gradient_accumulation_steps=a.grad_accum, num_train_epochs=a.epochs,
        learning_rate=a.lr, lr_scheduler_type="cosine", warmup_ratio=0.03, weight_decay=0.01,
        optim="adamw_8bit", bf16=bf16, fp16=not bf16, seed=a.seed,
        logging_steps=10, **{"eval_strategy|evaluation_strategy": "steps"}, eval_steps=a.eval_every,
        save_strategy="steps", save_steps=a.eval_every, save_total_limit=3,
        load_best_model_at_end=True, metric_for_best_model="eval_loss", greater_is_better=False,
        report_to="none"))
    trainer = SFTTrainer(**kwargs_for(SFTTrainer, model=model, args=cfg,
        train_dataset=ds["train"], eval_dataset=ds["eval"], **{"processing_class|tokenizer": tokenizer},
        callbacks=[EarlyStoppingCallback(early_stopping_patience=a.patience)] if a.patience else None))
    # Learn only the assistant replies, not the system prompt or questions.
    trainer = train_on_responses_only(trainer, instruction_part=USER_PART, response_part=ASSISTANT_PART)

    t0 = time.time()
    trainer.train()
    final = trainer.evaluate()
    print(f"Finished in {(time.time() - t0) / 60:.1f} min · eval loss {final.get('eval_loss'):.4f}")
    json.dump({"args": vars(a), "final_eval": final, "history": trainer.state.log_history},
              open(os.path.join(run_dir, "training_log.json"), "w"), indent=1)

    # ---- save adapter
    lora_dir = os.path.join(run_dir, "lora")
    model.save_pretrained(lora_dir); tokenizer.save_pretrained(lora_dir)
    print(f"Saved LoRA adapter to {lora_dir}")

    # ---- quick sanity check
    FastLanguageModel.for_inference(model)
    for q in ["What are the three base bands for reading a d20 result?",
              "Skill check: Stealth 25, DEX 15, natural roll 9. What is the total and band?"]:
        ids = tokenizer.apply_chat_template([{"role": "system", "content": SYSTEM}, {"role": "user", "content": q}],
                                            add_generation_prompt=True, return_tensors="pt").to(model.device)
        out = model.generate(input_ids=ids, max_new_tokens=200, do_sample=False)
        print(f"\nQ: {q}\nA: {tokenizer.decode(out[0][ids.shape[1]:], skip_special_tokens=True).strip()}")

    # ---- export GGUF (Unsloth builds llama.cpp the first time; this can take several minutes)
    quants = [x.strip() for x in a.quants.split(",") if x.strip()]
    if quants:
        gguf_dir = os.path.join(run_dir, "gguf")
        model.save_pretrained_gguf(gguf_dir, tokenizer, quantization_method=quants)
        print(f"GGUF files written to {gguf_dir}")


if __name__ == "__main__":
    main()

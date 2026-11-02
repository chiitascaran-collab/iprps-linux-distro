Put the IPRPS signing key's PUBLIC part here before building iprps-keyring (guide 12.12, step 1):

  iprps.gpg       gpg --export --armor <fingerprint> > iprps.gpg
  iprps-trusted   echo "<fingerprint>:4:" > iprps-trusted

Never put the private key (gpg --export-secret-keys) in this folder.

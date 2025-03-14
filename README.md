# MALICIOUS EXTENSION - EXTENSION MALICIEUSE

Ce projet est à but d'exemple pour montrer les risques que peuvent poser les extensions Chrome. Ce genre d'extensions Bypass tous les antivirus et n'est détectable que par l'utilisateur. Le code n'a pas besoin d'être Obfuscaté.
L'extension peut être installer de manière automatique par le biais d'un .lnk ce que je ne montrerais pas ici.

# FONCTIONNEMENT

Content.JS log les touches de l'utilisateur et background.JS s'occupe de l'envoyer côté serveur. Côté serveur, index.PHP met les touches envoyées par l'extension dans un fichier TXT.

# EXEMPLE DU RÉSULTAT

![Anti](https://user-images.githubusercontent.com/116922649/198746045-f7e3aa26-6b6b-40e0-853d-806d8fe3580f.PNG)

# <img alt="Data FAIR logo" src="https://cdn.jsdelivr.net/gh/data-fair/data-fair@master/ui/public/assets/logo.svg" width="40"> @data-fair/catalog-ftp

FTP/FTPS plugin for the Data Fair catalogs service.

Seul le mode passif est supporté (limite de `basic-ftp`, pas de mode actif). Les erreurs de connexion de type timeout sont journalisées avec l'adresse IP ciblée, pour faciliter une demande d'ouverture de flux.

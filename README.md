# <img alt="Data FAIR logo" src="https://cdn.jsdelivr.net/gh/data-fair/data-fair@master/ui/public/assets/logo.svg" width="40"> @data-fair/catalog-ftp

FTP/FTPS plugin for the Data Fair catalogs service.

- Anonymous access when the login is left empty.
- Plain FTP, explicit FTPS (`AUTH TLS`, port 21) or implicit FTPS (port 990). The server certificate is always verified: for a self-signed certificate or one issued by a private authority, paste the PEM certificate of that authority in the "CA certificate" field.
- Only the passive mode is supported (limitation of `basic-ftp`, no active mode). The connection test run when the catalog is saved also opens a passive data connection, so blocked passive ports are reported at that time.
- Connection timeouts are logged and reported with the targeted IP address, to help request a firewall opening.

## Tests

`npm test` starts a pure-ftpd container (`test-it/docker-compose.yml`, ports 2121 and 30000-30009) that serves plain FTP and explicit FTPS with the self-signed certificate of `test-it/config/`.

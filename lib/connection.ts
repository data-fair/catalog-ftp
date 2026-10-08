import { lookup } from 'node:dns/promises'
import { Client, type AccessOptions } from 'basic-ftp'
import type { FTPConfig } from '#types'

/**
 * Resolve connection options for FTP / FTPS.
 * - An empty login means anonymous access (basic-ftp defaults to anonymous/guest).
 * - Implicit FTPS uses port 990 when the port was left at its default value.
 * - Certificate verification is left strict: a self-signed certificate fails
 *   instead of being silently trusted, unless its authority is given in `ca`.
 */
export const ftpAccessOptions = (catalogConfig: FTPConfig, secrets: Record<string, string>): AccessOptions => {
  const implicit = catalogConfig.secure === 'implicit'
  const port = implicit && (!catalogConfig.port || catalogConfig.port === 21) ? 990 : (catalogConfig.port ?? 21)
  const secure = implicit ? 'implicit' : catalogConfig.secure === 'explicit'
  const password = catalogConfig.password === '********' ? secrets.password : catalogConfig.password
  return {
    host: catalogConfig.url,
    port,
    secure,
    ...(secure && catalogConfig.ca ? { secureOptions: { ca: catalogConfig.ca } } : {}),
    ...(catalogConfig.login ? { user: catalogConfig.login } : {}),
    ...(catalogConfig.login && password ? { password } : {})
  }
}

const isTimeout = (err: any) => err?.code === 'ETIMEDOUT' || /timeout|timed out/i.test(err?.message ?? '')

/**
 * Timeouts are the most common connection failure and the hardest to diagnose from
 * the config alone: the host name means nothing to whoever must open a firewall rule.
 * Resolve it and enrich the error message with the IP actually targeted.
 */
export const ftpConnectionError = async (err: any, access: AccessOptions) => {
  if (!isTimeout(err)) return err
  let ip = 'unknown ip'
  if (access.host) {
    try {
      ip = (await lookup(access.host)).address
    } catch (lookupError) {
      console.error(`Could not resolve ${access.host} after connection timeout`, lookupError)
    }
  }
  const target = `${access.host} (${ip}):${access.port}`
  console.error(`FTP connection timeout to ${target}`, err)
  return new Error(`Connection timed out to ${target}`, { cause: err })
}

/**
 * Open a single FTP(S) connection. The caller must close the returned client
 * (the plugin runs inside long lived processes).
 */
export const openFTPClient = async (catalogConfig: FTPConfig, secrets: Record<string, string>) => {
  const client = new Client(30000)
  const access = ftpAccessOptions(catalogConfig, secrets)
  try {
    await client.access(access)
  } catch (err) {
    client.close()
    throw await ftpConnectionError(err, access)
  }
  return client
}

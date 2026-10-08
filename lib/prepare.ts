import type { FTPConfig } from '#types'
import type { PrepareContext } from '@data-fair/types-catalogs'
import type { FTPCapabilities } from './capabilities.ts'
import { openFTPClient } from './connection.ts'

export default async ({ catalogConfig, secrets }: PrepareContext<FTPConfig, FTPCapabilities>) => {
  if (catalogConfig.password && catalogConfig.password !== '********') {
    secrets.password = catalogConfig.password
    catalogConfig.password = '********'
  }
  // anonymous access or cleared password: do not keep a stale secret
  if (!catalogConfig.login || !catalogConfig.password) {
    delete secrets.password
    delete catalogConfig.password
  }

  // try the FTP connection, including a listing: the passive data connection
  // uses other ports than the control one and is often the part blocked by a firewall
  try {
    const client = await openFTPClient(catalogConfig, secrets)
    try {
      await client.list()
    } finally {
      client.close()
    }
  } catch (error: any) {
    console.error('Connection test failed:', error)
    throw new Error(`Connection test failed: ${error.message}`, { cause: error })
  }

  return {
    catalogConfig,
    secrets
  }
}

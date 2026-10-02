import type { FTPConfig } from '#types'
import type { PrepareContext } from '@data-fair/types-catalogs'
import type { FTPCapabilities } from './capabilities.ts'
import { openFTPClient } from './connection.ts'

export default async ({ catalogConfig, secrets }: PrepareContext<FTPConfig, FTPCapabilities>) => {
  if (catalogConfig.password === '') {
    delete secrets.password
  } else if (catalogConfig.password && catalogConfig.password !== '********') {
    secrets.password = catalogConfig.password
    catalogConfig.password = '********'
  }

  // try the FTP connection
  try {
    const client = await openFTPClient(catalogConfig, secrets)
    client.close()
  } catch (error) {
    console.error('Connection test failed:', error)
    throw new Error('Connection test failed', { cause: error })
  }

  return {
    catalogConfig,
    secrets
  }
}

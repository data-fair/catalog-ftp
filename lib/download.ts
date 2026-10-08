import type { FTPConfig } from '#types'
import type { CatalogPlugin, GetResourceContext, Resource } from '@data-fair/types-catalogs'
import { openFTPClient } from './connection.ts'
import { normalizePath } from './imports.ts'

/**
 * Download locally a specific resource from a FTP server, and retrieves the metadata with the filepath of the downloaded file.
 *
 * @param context - The context containing catalog configuration, secrets, resource ID and temporary directory path.
 * @returns A `Resource` object representing the file.
 */
export const getResource = async (context: GetResourceContext<FTPConfig>): ReturnType<CatalogPlugin['getResource']> => {
  const resource = await getMetaData(context)
  resource.filePath = await downloadResource(context)
  return resource
}

export const getMetaData = async ({ resourceId }: GetResourceContext<FTPConfig>): Promise<Resource> => {
  const name = resourceId.substring(resourceId.lastIndexOf('/') + 1)
  const pointPos = name.lastIndexOf('.')
  return {
    id: resourceId,
    title: name,
    format: (pointPos === -1) ? '' : (name.substring(pointPos + 1)),
    filePath: ''
  }
}

/**
 * Downloads a resource (file) from the FTP server to a temporary directory.
 *
 * @param context - The context containing catalog configuration, resource ID, import configuration, and temporary directory path.
 * @returns The local path to the downloaded file.
 * @throws Will throw an error if the connection configuration is invalid.
 */
const downloadResource = async ({ catalogConfig, resourceId, secrets, tmpDir }: GetResourceContext<FTPConfig>) => {
  let client
  try {
    client = await openFTPClient(catalogConfig, secrets)
  } catch (err: any) {
    throw new Error(`Invalid configuration: ${err.message}`, { cause: err })
  }

  const remotePath = normalizePath(resourceId).replace(/^\.\//, '')
  const destinationPath = tmpDir + '/' + remotePath.substring(remotePath.lastIndexOf('/') + 1)

  // the plugin runs inside the long lived catalogs worker: an undisposed
  // connection keeps a session alive on the server until the pod restarts
  try {
    await client.downloadTo(destinationPath, remotePath)
    return destinationPath
  } catch (error) {
    console.error('Error downloading file:', error)
    throw error
  } finally {
    client.close()
  }
}

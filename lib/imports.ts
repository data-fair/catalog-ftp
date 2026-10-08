import type { FTPConfig } from '#types'
import type { FileInfo } from 'basic-ftp'
import type capabilities from './capabilities.ts'
import type { ListContext, Folder, CatalogPlugin } from '@data-fair/types-catalogs'
import { openFTPClient } from './connection.ts'

type ResourceList = Awaited<ReturnType<CatalogPlugin['list']>>['results']

/**
 * Normalize a folder or resource id into the './a/b' form produced by the listing of the root folder.
 * Ids stored without the './' prefix, with doubled or trailing slashes, still resolve to the same path.
 */
export const normalizePath = (id?: string) => {
  const path = (id ?? '').replace(/\/{2,}/g, '/').replace(/^(\.\/)+/, '').replace(/^\.$/, '').replace(/\/$/, '')
  if (!path) return '.'
  return path.startsWith('/') ? path : './' + path
}

/**
 * Prepares a list of files and folders from the FTP directory listing.
 *
 * @param list - The array of file objects returned by the FTP `list` method.
 * @param path - The current directory path.
 * @returns An array of `Folder` or `ResourceList` objects representing the files and folders.
 */
const prepareFiles = (list: FileInfo[], path: string): (Folder[] | ResourceList) => {
  return list.map((file: FileInfo) => {
    const pointPos = file.name.lastIndexOf('.')
    if (file.isDirectory) {
      // Folder
      return {
        id: path + '/' + file.name,
        title: file.name,
        type: 'folder',
        updatedAt: file.modifiedAt?.toISOString()
      } as Folder
    } else {
      // ResourceList
      return {
        id: path + '/' + file.name,
        title: file.name,
        type: 'resource',
        description: '',
        format: (pointPos === -1) ? '' : (file.name.substring(pointPos + 1)),
        mimeType: '',
        size: file.size,
        updatedAt: file.modifiedAt?.toISOString()
      } as ResourceList[number]
    }
  })
}

/**
 * Lists the contents of a folder on an FTP server.
 *
 * @param context - The context containing catalog configuration and parameters.
 * @returns An object containing the count of items, the list of results (folders and resources), and the path as an array of folders.
 * @throws Will throw an error if the connection configuration is invalid or not supported.
 */
export const list = async ({ catalogConfig, secrets, params }: ListContext<FTPConfig, typeof capabilities>): ReturnType<CatalogPlugin['list']> => {
  let client
  try {
    client = await openFTPClient(catalogConfig, secrets)
  } catch (err: any) {
    throw new Error(`Invalid configuration: ${err.message}`, { cause: err })
  }

  // the plugin runs inside the long lived catalogs process: an undisposed
  // connection keeps a session alive on the server until the pod restarts
  try {
    const path = normalizePath(params.currentFolderId)
    const results = prepareFiles(await client.list(path), path)

    // breadcrumb with the same ids as the listing ('./a', './a/b'), absolute paths keep their leading '/'
    const pathFolder: Folder[] = []
    let parentId = path
    while (parentId !== '.' && parentId !== '') {
      pathFolder.unshift({
        id: parentId,
        title: parentId.substring(parentId.lastIndexOf('/') + 1),
        type: 'folder'
      })
      parentId = parentId.substring(0, parentId.lastIndexOf('/'))
    }

    return {
      count: results.length,
      results,
      path: pathFolder
    }
  } finally {
    client.close()
  }
}

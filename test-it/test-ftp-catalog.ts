import type { FTPConfig } from '#types'
import type { CatalogPlugin } from '@data-fair/types-catalogs'

import { strict as assert } from 'node:assert'
import { describe, it, before, after, beforeEach } from 'node:test'
import { logFunctions } from './test-utils.ts'

import fs from 'fs-extra'
import util from 'util'
import { exec as execCallback } from 'child_process'
import { ftpAccessOptions, ftpConnectionError } from '../lib/connection.ts'

// Import plugin and use default type like it's done in Catalogs
import plugin from '../index.ts'
const catalogPlugin: CatalogPlugin = plugin as CatalogPlugin

const exec = util.promisify(execCallback)

/** Mock catalog configuration for testing purposes. */
const catalogConfig: FTPConfig = {
  url: 'localhost',
  port: 2121,
  login: 'test3',
  password: '********',
  secure: 'none'
}

const secrets = { password: '12345' }

const getResourceDefaultConfig = {
  catalogConfig,
  secrets,
  importConfig: { },
  update: { metadata: true, schema: true },
  tmpDir: './test-it/test-dl',
  log: logFunctions
}

// Configurations invalides pour les tests d'erreur
const invalidTestsConfigs: { description: string, config: FTPConfig, secret: Record<string, string> }[] = [
  {
    description: 'should throw an error with an invalid url',
    config: {
      url: 'exemple',
      port: 2121,
      login: 'test3',
      password: '********',
      secure: 'none'
    },
    secret: secrets
  },
  {
    description: 'should throw an error with an invalid port',
    config: {
      url: 'localhost',
      port: 1,
      login: 'test3',
      password: '********',
      secure: 'none'
    },
    secret: secrets
  },
  {
    description: 'should throw an error with an invalid login',
    config: {
      url: 'localhost',
      port: 2121,
      login: 'wrongLogin',
      password: '********',
      secure: 'none'
    },
    secret: secrets
  },
  {
    description: 'should throw an error with an invalid password',
    config: {
      url: 'localhost',
      port: 2121,
      login: 'test3',
      password: '********',
      secure: 'none'
    },
    secret: { password: '0000' }
  }
]

describe('test the ftp catalog', () => {
  // Démarrage et initialisation du serveur FTP avant les tests
  before(async () => {
    try {
      const { stdout, stderr } = await exec('docker compose up -d', { cwd: './test-it' })
      console.log(stdout)
      console.error(stderr)

      // Temps d'attente pour permettre au conteneur de vraiment se lancer
      await new Promise(resolve => setTimeout(resolve, 5000))
    } catch (err) {
      console.error('Erreur pendant le démarrage :', err)
      throw err
    }
  })

  // Arrêt du serveur FTP après les tests
  after(async () => {
    try {
      const { stdout, stderr } = await exec('docker compose down', { cwd: './test-it' })
      console.log(stdout)
      console.error(stderr)
    } catch (err) {
      console.error("Erreur pendant l'arrêt", err)
    }
  })

  describe('test the list function', () => {
    it('should list resources and folder from landing-zone', async () => {
      const res = await catalogPlugin.list({ catalogConfig, secrets, params: { currentFolderId: './landing-zone' } })
      assert.strictEqual(res.count, res.results.length, 'la taille des resultats et du compte ne correspondent pas')
      assert.strictEqual(res.count, 3)
      assert.strictEqual(res.path.length, 1)
      assert.strictEqual(res.path[0].title, 'landing-zone')
      assert.ok(res.results.some((val) => val.title === 'test.txt'))
      assert.ok(res.results.some((val) => val.id === './landing-zone/test.txt'))
      assert.ok(res.results.some((val) => val.type === 'resource'))

      assert.ok(res.results.some((val) => val.title === 'donnees'))
      assert.ok(res.results.some((val) => val.id === './landing-zone/donnees'))
      assert.ok(res.results.some((val) => val.type === 'folder'))
    })

    it('should list resources and folder from a sub-folder', async () => {
      const res = await catalogPlugin.list({ catalogConfig, secrets, params: { currentFolderId: './landing-zone/donnees' } })
      assert.strictEqual(res.count, res.results.length, 'la taille des resultats et du compte ne correspondent pas')
      assert.strictEqual(res.count, 2)
      assert.strictEqual(res.path.length, 2)
      assert.strictEqual(res.path[1].title, 'donnees')
      assert.ok(res.results.some((val) => val.title === 'donnees.csv'))
      assert.ok(res.results.some((val) => val.id === './landing-zone/donnees/donnees.csv'))
      assert.ok(res.results.some((val) => val.type === 'resource'))
    })

    describe('FTP list erreur', () => {
      invalidTestsConfigs.forEach(({ description, config, secret }) => {
        it('list ' + description, async () => {
          await assert.rejects(
            async () => {
              await catalogPlugin.list({
                catalogConfig: config,
                secrets: secret,
                params: { currentFolderId: './' }
              })
            },
            /Invalid configuration/,
            'Doit renvoyer une erreur'
          )
        })
      })
    })
  })

  describe('test the getResource function', () => {
    before(() => {
      if (!fs.existsSync('./test-it/test-dl')) {
        fs.mkdirSync('./test-it/test-dl', { recursive: true })
      }
    })
    beforeEach(() => fs.emptyDirSync('./test-it/test-dl'))
    after(() => fs.removeSync('./test-it/test-dl'))

    it('should return the resource test.txt', async () => {
      const res = await catalogPlugin.getResource({
        ...getResourceDefaultConfig,
        resourceId: './landing-zone/test.txt',
      })
      assert.ok(res)
      assert.strictEqual(res.title, 'test.txt')
      assert.strictEqual(res.id, './landing-zone/test.txt')
      assert.strictEqual(res.format, 'txt')
      assert.strictEqual(res.filePath, './test-it/test-dl/test.txt')
      const fileExists = await fs.pathExists(res.filePath)
      assert.ok(fileExists, 'The downloaded file should exist')
    })
  })

  describe('FTP getResource erreur', () => {
    invalidTestsConfigs.forEach(({ description, secret, config }) => {
      it('getResource ' + description, async () => {
        await assert.rejects(
          async () => {
            await catalogPlugin.getResource({
              ...getResourceDefaultConfig,
              catalogConfig: config,
              secrets: secret,
              resourceId: './landing-zone/test.txt'
            })
          },
          /Invalid configuration/,
          'Doit renvoyer une erreur'
        )
      })
    })

    it('getResource should throw an error with an invalid resourceId', async () => {
      await assert.rejects(
        async () => {
          await catalogPlugin.getResource({
            ...getResourceDefaultConfig,
            resourceId: './landing-zone/something-wrong'
          })
        },
        /550|no such file/i,
        'Doit renvoyer une erreur'
      )
    })
  })

  describe('prepare', () => {
    it('should mask password and set secret when password is provided', async () => {
      const catalogConfig: FTPConfig = {
        url: 'localhost',
        port: 2121,
        login: 'test3',
        password: '12345',
        secure: 'none'
      }
      const secrets: Record<string, string> = {}

      const { catalogConfig: newConfig, secrets: newSecrets } = await catalogPlugin.prepare({
        catalogConfig: deepClone(catalogConfig),
        secrets,
        capabilities: []
      })

      assert.ok(newConfig, 'newConfig should not be undefined')
      assert.strictEqual((newConfig as FTPConfig).password, '********')
      assert.strictEqual(newSecrets?.password, '12345')
    })

    it('should throw an error with invalid config', async () => {
      await assert.rejects(async () => {
        await catalogPlugin.prepare({
          catalogConfig: {
            ...deepClone(catalogConfig),
            url: 'invalid-url'
          },
          secrets: {},
          capabilities: []
        })
      }, /Connection test failed/, 'Doit renvoyer une erreur')
    })
  })

  describe('connection options', () => {
    it('should default to anonymous access without login', () => {
      const access = ftpAccessOptions({ url: 'ftp.exemple.fr' }, {})
      assert.strictEqual(access.host, 'ftp.exemple.fr')
      assert.strictEqual(access.port, 21)
      assert.strictEqual(access.secure, false)
      assert.strictEqual(access.user, undefined)
      assert.strictEqual(access.password, undefined)
    })

    it('should use the secret password when the config one is masked', () => {
      const access = ftpAccessOptions({ url: 'ftp.exemple.fr', login: 'bob', password: '********' }, { password: 's3cr3t' })
      assert.strictEqual(access.user, 'bob')
      assert.strictEqual(access.password, 's3cr3t')
    })

    it('should use implicit TLS on port 990 by default, and keep an explicit port', () => {
      const implicit = ftpAccessOptions({ url: 'ftp.exemple.fr', secure: 'implicit' }, {})
      assert.strictEqual(implicit.port, 990)
      assert.strictEqual(implicit.secure, 'implicit')

      const explicitPort = ftpAccessOptions({ url: 'ftp.exemple.fr', port: 2121, secure: 'implicit' }, {})
      assert.strictEqual(explicitPort.port, 2121)
    })

    it('should use explicit TLS when asked', () => {
      const access = ftpAccessOptions({ url: 'ftp.exemple.fr', secure: 'explicit' }, {})
      assert.strictEqual(access.secure, true)
    })
  })

  describe('timeout errors', () => {
    const access = { host: 'localhost', port: 2121 }

    it('should resolve the IP and log it on connection timeout', async () => {
      const err = await ftpConnectionError(new Error('Timeout (control socket)'), access)
      assert.match(err.message, /Connection timed out to localhost \((127\.0\.0\.1|::1)\):2121/)
    })

    it('should resolve the IP on ETIMEDOUT too', async () => {
      const err = await ftpConnectionError(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }), access)
      assert.match(err.message, /Connection timed out to localhost \((127\.0\.0\.1|::1)\):2121/)
    })

    it('should leave other errors untouched', async () => {
      const original = new Error('530 Login incorrect')
      const err = await ftpConnectionError(original, access)
      assert.strictEqual(err, original)
    })
  })

  function deepClone<T> (obj: T): T {
    return JSON.parse(JSON.stringify(obj))
  }
})

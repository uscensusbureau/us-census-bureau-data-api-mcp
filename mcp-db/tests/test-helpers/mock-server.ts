import express from 'express'
import { Server } from 'http'

interface Request {
  query: Record<string, string>
  params: Record<string, string>
  body: unknown
  path: string
  method: string
}

interface Response {
  status(code: number): Response
  json(data: unknown): void
  send(data: unknown): void
}

type RouteHandler = (req: Request, res: Response) => void

export type HttpAction = (path: string, handler: RouteHandler) => void
export type CloseAction = () => Promise<void>

export function setupMockServer(): {
  get: HttpAction
  post: HttpAction
  port: number
  close: CloseAction
} {
  const app = express()
  app.use(express.json())

  let server: Server
  const routes: Map<string, RouteHandler> = new Map()

  const mockServer = {
    port: 3001,

    get(path: string, handler: RouteHandler): HttpAction {
      routes.set(`GET:${path}`, handler)
    },

    post(path: string, handler: RouteHandler): HttpAction {
      routes.set(`POST:${path}`, handler)
    },

    start() {
      app.use((req, res) => {
        const key = `${req.method}:${req.path}`
        const handler = routes.get(key)

        if (handler) {
          handler(req, res)
        } else {
          res.status(404).json({ error: 'Not found' })
        }
      })

      server = app.listen(this.port)
      return server
    },

    close(): CloseAction {
      return new Promise<void>((resolve) => {
        server?.close(() => resolve())
      })
    },
  }

  mockServer.start()
  return mockServer
}

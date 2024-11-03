import { Hono } from 'hono'

type Bindings = {
  massage418_session_kv: KVNamespace;
}
const app = new Hono<{Bindings: Bindings}>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/kv/put', async (c) => {
  await c.env.massage418_session_kv.put('hoge', 'hogeValue')
  return c.text('put value!')
})

app.get('/kv/get', async (c) => {
  const hogeValue = await c.env.massage418_session_kv.get('hoge')
  return c.text(hogeValue ?? 'no value!')
})

app.get('/kv/delete', async (c) => {
  await c.env.massage418_session_kv.delete('hoge')
  return c.text('delete value!')
})

export default app

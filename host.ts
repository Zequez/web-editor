import { serve } from "https://deno.land/std@0.165.0/http/server.ts";
import { BufReader } from "https://deno.land/std/io/mod.ts";
import {
  copy,
  readAll,
} from "https://deno.land/std@0.165.0/streams/conversion.ts";

const port = 789;

const server = Deno.listen({ port });
console.log(`File server running on http://localhost:/${port}`);

// function handler (req: Request): Response {

//   return new Response(body, {status: 200});
// }

for await (const conn of server) {
  handleHttp(conn).catch(console.error);
}

async function handleHttp(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const { request, respondWith } of httpConn) {
    // Use the request pathname as filepath
    const url = new URL(request.url);

    const filepath = decodeURIComponent(url.pathname);
    const save = url.searchParams.get("save") !== null;

    console.log({
      filepath,
      save,
    });

    if (filepath.match(/\.\./)) {
      await respondWith(new Response("Not allowed", { status: 500 }));
      return;
    }

    if (save) {
      if (request.body) {
        // const data = await readAll(request.body.getReader());
        const file = await Deno.open("./save.tmp.txt", {
          create: true,
          write: true,
          truncate: true,
        });
        await request.body.pipeTo(file.writable);
        await Deno.copyFile("./save.tmp.txt", `.${filepath}`);
        await respondWith(Response.json({ success: true }));
      } else {
        await respondWith(
          Response.json({ error: "Must provide request body" }, { status: 400 })
        );
      }
    } else {
      // Try opening the file
      let file;
      try {
        file = await Deno.open("." + filepath, { read: true });
      } catch {
        // If the file cannot be opened, return a "404 Not Found" response
        const notFoundResponse = new Response("404 Not Found", { status: 404 });
        await respondWith(notFoundResponse);
        return;
      }

      // Build a readable stream so the file doesn't have to be fully loaded into
      // memory while we send it
      const readableStream = file.readable;

      // Build and send the response
      const response = new Response(readableStream);
      await respondWith(response);
    }
  }
}

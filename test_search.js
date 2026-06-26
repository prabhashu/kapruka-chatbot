import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "mata choclate cake ekak oni" }]
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();

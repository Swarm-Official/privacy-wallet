// Can this machine reach the wallet server at all?
//
// Asked separately from the smoke test, and it never skips: if the runner
// cannot get to lwd.swarm.green the evidence has to say so, because otherwise
// a green build tells you nothing about whether the thing a user connects to
// was up when it was made.
//
// A TLS handshake, not a gRPC call. What is being established is that the name
// resolves, the port answers and the certificate is the one we expect — the
// wallet itself is the only thing that should be speaking the wallet protocol.
const tls = require("tls");

const HOST = "lwd.swarm.green";
const PORT = 443;
const TIMEOUT_MS = 15_000;

const socket = tls.connect({ host: HOST, port: PORT, servername: HOST, timeout: TIMEOUT_MS }, () => {
  const certificate = socket.getPeerCertificate();
  console.log(`reachable   : yes`);
  console.log(`subject     : ${certificate.subject?.CN ?? "(none)"}`);
  console.log(`issuer      : ${certificate.issuer?.O ?? "(none)"}`);
  console.log(`valid to    : ${certificate.valid_to ?? "(unknown)"}`);
  console.log(`authorised  : ${socket.authorized ? "yes" : `no — ${socket.authorizationError}`}`);
  socket.end();
  // Not a failure of the build: a runner behind a proxy, or a server restart,
  // is not a reason to refuse a package. It is a fact worth recording beside
  // the artifacts, so the state of the network when they were made is known.
  process.exit(0);
});

const giveUp = (why) => {
  console.log(`reachable   : NO — ${why}`);
  console.log("The packages are still valid; this records what the runner could see, not a build failure.");
  process.exit(0);
};

socket.on("timeout", () => {
  socket.destroy();
  giveUp(`no answer within ${TIMEOUT_MS / 1000}s`);
});
socket.on("error", (error) => giveUp(error.message));

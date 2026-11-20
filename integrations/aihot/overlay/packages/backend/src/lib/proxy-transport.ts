import net from "node:net";
import type { buildConnector } from "undici";

/** TLS verifies an IP endpoint against the certificate's IP SAN. SNI only accepts DNS names. */
export function proxyTransport(origin: URL, options: object): object {
  const connect = (options as {connect?: buildConnector.connector}).connect;
  if (origin.protocol !== "https:" || !net.isIP(origin.hostname.replace(/^\[|\]$/g, "")) || typeof connect !== "function") return options;
  const withoutIpSni: buildConnector.connector = (target, callback) =>
    connect({ ...target, servername: undefined }, callback);
  return { ...options, connect: withoutIpSni };
}

# I Message Queue RPC (imq-rpc)

RPC-like client-service implementation over messaging queue.

## Notes

For image containers builds assign machine UUID in `/etc/machine-id` and 
`/var/lib/dbus/machine-id` respectively. UUID should be assigned once on
a first build then re-used each ne build to make it work consistently.

## License

[ISC](https://github.com/Mikhus/imq-rpc/blob/master/LICENSE)

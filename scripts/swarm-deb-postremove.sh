#!/bin/bash
# Undoes what swarm-deb-postinstall.sh put outside /opt.
#
# Nothing here touches the user's wallet: that lives in their home directory
# and removing the application must never remove their coins.

rm -f '/usr/share/polkit-1/actions/green.swarm.wallet.policy'

# Only our own symlink, never one a user made themselves pointing elsewhere.
if [ -L /usr/bin/swarm-wallet ] \
   && [ "$(readlink /usr/bin/swarm-wallet)" = '/opt/SWARM Wallet (Testnet)/SWARM Wallet Testnet' ]; then
    rm -f /usr/bin/swarm-wallet
fi

APPARMOR_DST='/etc/apparmor.d/swarm-wallet'
if [ -f "$APPARMOR_DST" ]; then
    if command -v apparmor_parser >/dev/null 2>&1; then
        apparmor_parser -R "$APPARMOR_DST" 2>/dev/null || true
    fi
    rm -f "$APPARMOR_DST"
fi

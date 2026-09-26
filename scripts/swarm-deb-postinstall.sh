#!/bin/bash
# Runs after `dpkg -i` of the SWARM Wallet .deb.
#
# Upstream's postinstall hard-codes "/opt/Zingo PC/..." throughout. Renaming
# the product moves every one of those paths, and because each step is guarded
# by `if [ -f ... ]`, a copied script would not fail — it would quietly do
# nothing, and the two things it exists to fix would come back: Chromium
# refusing to start on Ubuntu 22.04+ without a SUID chrome-sandbox, and dying
# outright on 24.04+ without an AppArmor profile. So the paths are ours.
set -e

# Two packages can be installed: the mainnet wallet lives in
# /opt/SWARM Wallet and the testnet one in /opt/SWARM Wallet (Testnet). They
# have different app ids and neither replaces the other, so this script — which
# ships inside whichever .deb is being installed — finds the directory that
# exists rather than naming one.
for candidate in '/opt/SWARM Wallet' '/opt/SWARM Wallet (Testnet)'; do
    if [ -d "$candidate" ]; then
        APP_DIR="$candidate"
        break
    fi
done
[ -n "${APP_DIR:-}" ] || exit 0

# 1. Chromium's setuid sandbox helper. Ubuntu 22.04+ and Debian 11+ restrict
#    unprivileged user namespaces, and without this the renderer cannot start.
CHROME_SANDBOX="$APP_DIR/chrome-sandbox"
if [ -f "$CHROME_SANDBOX" ]; then
    chown root "$CHROME_SANDBOX"
    chmod 4755 "$CHROME_SANDBOX"
fi

# 2. AppArmor profile, for 24.04+ where the sysctl above is replaced by an
#    AppArmor restriction and the SUID helper alone is not enough.
APPARMOR_SRC="$APP_DIR/resources/apparmor-swarm-wallet"
APPARMOR_DST='/etc/apparmor.d/swarm-wallet'
if [ -f "$APPARMOR_SRC" ] && [ -d /etc/apparmor.d ]; then
    cp "$APPARMOR_SRC" "$APPARMOR_DST"
    chmod 644 "$APPARMOR_DST"
    if command -v apparmor_parser >/dev/null 2>&1; then
        apparmor_parser -r "$APPARMOR_DST" 2>/dev/null || true
    fi
fi

# 3. The polkit action behind device authentication. Without it the wallet
#    finds no action registered and skips the unlock screen rather than
#    offering a button that cannot work.
POLICY_SRC="$APP_DIR/resources/green.swarm.wallet.policy"
POLICY_DST='/usr/share/polkit-1/actions/green.swarm.wallet.policy'
if [ -f "$POLICY_SRC" ]; then
    cp "$POLICY_SRC" "$POLICY_DST"
    chmod 644 "$POLICY_DST"
fi

# 4. A name on the PATH. electron installs under a directory with spaces and
#    parentheses, which is not somewhere anyone wants to type.
for name in 'SWARM Wallet' 'SWARM Wallet Testnet'; do
    if [ -f "$APP_DIR/$name" ] && [ -d /usr/bin ]; then
        ln -sf "$APP_DIR/$name" /usr/bin/swarm-wallet
        break
    fi
done

# Upstream additionally rewrites the .desktop Exec line to route through a
# wrapper that forwards `zcash:` payment links. This build deliberately
# registers no such handler — it is not a wallet for the public Zcash network
# — so there is no wrapper and nothing to rewrite.

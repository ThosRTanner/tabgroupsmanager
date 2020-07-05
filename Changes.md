# Changes for v 1.0.0 (pre-prelease)
* Added explicit palemoon support
* Kicked min versions to 56 (basilisk), 28 (palemoon)
* because session mananger no longer exposes a global, the 'Override session manager restore session' preference has been withdrawn. Instead there's a 'use session manager sessions' preference. A note: You *really* should set this if you're using session manager.
* Groups now retain icons and order on restart

# Changes for v 1.1.0 (pre-release)
* Update contributor list

# Changes for v 1.0.1
* Fix restoring session on palemoon getting tabs in the wrong order. This ended up removing a lot of unnecessary operations, and has made reloading sessions a lot snappier. (Issue #4)
* Remove the original license.txt file (Issue #26)

# Changes for v 1.0.0
* Added explicit palemoon support
* Kicked min versions to 56 (basilisk), 28 (palemoon)
* because session mananger no longer exposes a global, the 'Override session manager restore session' preference has been withdrawn. Instead there's a 'use session manager sessions' preference - which currently does nothing and may be withdrawn anyway.
* Groups now retain icons and order on restart

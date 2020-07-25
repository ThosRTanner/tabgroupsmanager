# Changes for v 1.1.0 (pre-release)
* Update contributor list (Issue #29)
* Remove check for old version of tab mix plus. (Issue #20)
* Remove checks for older versions of firefox (Issue #17)
* Fix problem of losing icons/group names when restoring sessions with multiple windows (Issue #34)
* Fix regression causing missing menus when browser is set to restore tabs/windows (Issue #35)

# Changes for v 1.0.1
* Fix restoring session on palemoon getting tabs in the wrong order. This ended up removing a lot of unnecessary operations, and has made reloading sessions a lot snappier. (Issue #4)
* Remove the original license.txt file (Issue #26)

# Changes for v 1.0.0
* Added explicit palemoon support
* Kicked min versions to 56 (basilisk), 28 (palemoon)
* because session mananger no longer exposes a global, the 'Override session manager restore session' preference has been withdrawn. Instead there's a 'use session manager sessions' preference - which currently does nothing and may be withdrawn anyway.
* Groups now retain icons and order on restart

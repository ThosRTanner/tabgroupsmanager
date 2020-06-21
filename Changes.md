TabGroups Manager Changelog
---------------------------

List of Issues:
https://bitbucket.org/tabgroupsmanager/tabgroupsmanager/issues?status=new&status=open


Changelog
---------

# 12.0.0 pre-prelease
* Kicked min versions to 56 (f/f), 28 (palemoon)
* because session mananger no longer exposes a global, the 'Override session manager restore session' preference has been withdrawn. Instead there's a 'use session manager sessions' preference. A note: You *really* should set this if you're using session manager.
* Changed CHANGELOG to Changes.md

# 2017.06.21.011
* Fixed compatibility Palemoon and maybe with older Firefox versions.
* Increased max version support to Firefox 56 and Palemoon 28.

# 2017.04.19.010
* Fixed issues with tab management with Firefox 51 and up. Drag and Drop did not work.

# 2016.02.03
* Removed all search plugins functions and all search plugins. Mozilla reports: 'they are a monetization feature that doesn't relate to the add-on's main function, and it needs to be strictly opt-in'.
* * (Maybe we could get them back in future, but not at this time when we still need to get signed by Mozilla).

# 2016.01.26
* Micha revisions from 252 to 282 in SVN. We will detail them in new bitbucket wiki.
* Miguel revisions to be validated in AMO. Check bitbucket for lastest commits.

# 2014.12.21
* Fixed bug with 'hidden' attribute which caused incompatibility with TabMixPlus. Now multirow works! :) (Thanks micha and Onemen (TMP developer) for all your help).
* We have reverted from 'collapsed' to 'hidden' doing it the right way: http://mxr.mozilla.org/mozilla-central/source/browser/base/content/tabbrowser.xml
* Fixed in Firefox >25 SessionStore initialize with promise initializeAfterOnLoad(), instead of the temporary fix patch. (fixed by micha. Thanks to Onemen (TMP developer) for support in this matter).
* Fixed tab.group is not defined at startup since Fx25+, with new promise future. In FX25+ is mandatory (fixed by micha).
* Fixed SessionManager to TabmixSessionManager to get rid off depreciated message (fixed by micha).
* Added debug output to empty catch, so we get info for loadAllGroupsData() in debug mode (micha).
* Added spaces between transparency tab groups for personas themes to overlay.css (micha).

# 2014.09.18
* Fixed critical bug, TGM not working because of tab functions changed with new Firefox v+33.
* * https://bugzilla.mozilla.org/show_bug.cgi?id=996053
* * https://blog.mozilla.org/addons/2014/10/01/compatibility-for-firefox-33

# 2014.08.21
* Fixes manual saving and loading session from TGM option Menu.
* Fixes loading session when Firefox loads. It will probably fix most horrible session restoring bugs.
* Fix to prevent showing two overlapped menu when right clicking a tab (fix by micha).
* Minor code fixes to prevent possible bugs.
## Known issues:
* DO NOT install Firefox extension: "Classic Theme Restorer". It will break session restoring!!!
* Small bug which could open a Start group in other firefox window when manually restoring session.
* Still there are minor known issues like not getting good group order or tab order sometimes, or a group not getting back its name.
* Restoring could be very slow when having thousands of tabs in windows. In linux it works faster.
* There are other critical issues reported, and we will look into all of them. Thank you for your patience.
* Tested with Windows and Linux in FF28 and FF31.
* If TGM 002 works fine for you, do not update.

# 2013.07.07
* Issue 8 and Issue 11 should have been solved.
* Fixes Drag and Drop a tab in the same Group could make the tab to disappear.
* Fixes Drag and Drop a tab to another Group could make the tab to disappear.
* Fixes tabs does not appear in Groups when upgrading to this version.

# 2013.04.10
* Fixes compatibility issues with Firefox +20 and up. TabGroups Manager was throwing some exceptions at start up.

# 2011.11.28
* Original Axel Shootingstar version.

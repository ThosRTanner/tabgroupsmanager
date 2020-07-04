/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.OverrideOtherAddOns = function ()
{
  this.overrideTreeStyleTab();
};

TabGroupsManager.OverrideOtherAddOns.prototype.delayOverride = function ()
{
  /*
  try
  {
    this.overrideSessionManager();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }*/
};

/*
//FIXME This no longer works, as session manager is now bootstrappable
//In any case we should use this (possible) to force backup of our groups
TabGroupsManager.OverrideOtherAddOns.prototype.overrideSessionManager = function ()
{
  if (("gSessionManager" in window) && TabGroupsManager.preferences.prefBranch.getBoolPref("useSessionManagerSessions"))
  {
    this.backup_gSessionManager_restoreSession = window.gSessionManager.restoreSession;
    window.gSessionManager.restoreSession = this.override_gSessionManager_restoreSession;
  }
};

TabGroupsManager.OverrideOtherAddOns.prototype.override_gSessionManager_restoreSession = function ()
{
  TabGroupsManager.session.restoreSessionInit();
  TabGroupsManager.overrideOtherAddOns.backup_gSessionManager_restoreSession.apply(this, arguments);
};
*/
TabGroupsManager.OverrideOtherAddOns.prototype.overrideTreeStyleTab = function ()
{
  if (("TreeStyleTabBrowser" in window) && TabGroupsManager.preferences.prefBranch.getBoolPref("overrideTreeStyleTab"))
  {
    this.backup_TreestyleTabBrowser_attachTabFromPosition = window.TreeStyleTabBrowser.prototype.attachTabFromPosition;
    window.TreeStyleTabBrowser.prototype.attachTabFromPosition = this.override_TreestyleTabBrowser_attachTabFromPosition;
  }
};

TabGroupsManager.OverrideOtherAddOns.prototype.override_TreestyleTabBrowser_attachTabFromPosition = function ()
{
  if (!TabGroupsManager.tabMoveByTGM.cancelTabMoveEventOfTreeStyleTab && TabGroupsManager.session.groupRestored >= 2)
  {
    TabGroupsManager.overrideOtherAddOns.backup_TreestyleTabBrowser_attachTabFromPosition.apply(this, arguments);
  }
};

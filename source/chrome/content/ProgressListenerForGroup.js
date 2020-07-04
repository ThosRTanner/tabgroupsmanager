/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.ProgressListenerForGroup = function(aOwnerGroup)
{
  try
  {
    this.ownerGroup = aOwnerGroup;
    this.startAndStop = Ci.nsIWebProgressListener.STATE_START | Ci.nsIWebProgressListener.STATE_STOP;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.ProgressListenerForGroup.prototype.QueryInterface = function(aIID)
{
  if (aIID.equals(Ci.nsIWebProgressListener) ||
    aIID.equals(Ci.nsISupportsWeakReference) ||
    aIID.equals(Ci.nsISupports))
  {
    return this;
  }
  throw Components.results.NS_NOINTERFACE;
};

TabGroupsManager.ProgressListenerForGroup.prototype.onStateChange = function(aWebProgress, aRequest, aFlag, aStatus)
{
  if (aFlag & this.startAndStop)
  {
    var ownerGroup = this.ownerGroup;
    setTimeout(function ()
    {
      ownerGroup.displayGroupBusy();
    }, 0);
    if (aFlag & Ci.nsIWebProgressListener.STATE_STOP)
    {
      if (aWebProgress.document && aWebProgress.document.location == "about:sessionrestore")
      {
        var button = aWebProgress.document.getElementById("errorTryAgain");
        //button.setAttribute("oncommand","getBrowserWindow().TabGroupsManager.session.restoreSessionFromAboutSessionRestore(); "+button.getAttribute("oncommand"));
        button.addEventListener("command", function(event)
        {
          getBrowserWindow().TabGroupsManager.session.restoreSessionFromAboutSessionRestore(); + button.getAttribute("oncommand");
        }, false);
      }
    }
  }
  return 0;
};

TabGroupsManager.ProgressListenerForGroup.prototype.onLocationChange = function(aProgress, aRequest, aURI)
{
  return 0;
};

TabGroupsManager.ProgressListenerForGroup.prototype.onProgressChange = function()
{
  return 0;
};

TabGroupsManager.ProgressListenerForGroup.prototype.onStatusChange = function()
{
  return 0;
};

TabGroupsManager.ProgressListenerForGroup.prototype.onSecurityChange = function()
{
  return 0;
};

TabGroupsManager.ProgressListenerForGroup.prototype.onLinkIconAvailable = function()
{
  return 0;
};


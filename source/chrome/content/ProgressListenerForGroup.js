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

//FIXME Deals with about:sessionrestore which happens when browser can't recover
//sessions. I'm not entirely sre how to cause that to happen but this looks wrong
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
        //FIXME It seems hard to believe this does anything useful.
/**/console.log(aWebProgress, aRequest, aFlag, aStatus)
        var button = aWebProgress.document.getElementById("errorTryAgain");
        //button.setAttribute("oncommand","getBrowserWindow().TabGroupsManager.session.restoreSessionFromAboutSessionRestore(); "+button.getAttribute("oncommand"));
        button.addEventListener("command", function(event)
        {
          getBrowserWindow().TabGroupsManager.session.restoreSessionFromAboutSessionRestore();
          +button.getAttribute("oncommand");
        }, false);
      }
    }
  }
};

//seems you don't need to provide these methods if they do nothing
/*
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
*/

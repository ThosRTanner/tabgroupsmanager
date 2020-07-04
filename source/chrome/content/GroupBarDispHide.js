/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.GroupBarDispHide = function()
{
  try
  {
    this.__defineGetter__("dispGroupBar", function()
    {
      return this.fDispGroupBar;
    });
    this.__defineSetter__("dispGroupBar", this.setDispGroupBar);
    this.fDispGroupBar = true;
    this.hideBarTimer = null;
    if (TabGroupsManager.preferences.hideGroupBarByContentClick)
    {
      this.setContentClickEvent();
    }
    if (TabGroupsManager.preferences.hideGroupBarByMouseover)
    {
      this.setMouseoverEvent();
    }
    if (TabGroupsManager.preferences.hideGroupBarByMouseout)
    {
      setTimeout(function ()
      {
        TabGroupsManager.groupBarDispHide.setMouseoutEvent();
      }, 0);
      setTimeout(function ()
      {
        TabGroupsManager.groupBarDispHide.dispGroupBar = false;
      }, 10000);
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupBarDispHide.prototype.setContentClickEvent = function()
{
  var contentArea = document.getAnonymousElementByAttribute(document.getElementById("content"), "anonid", "panelcontainer");
  contentArea.addEventListener("click", this.contentAreaClick, false);
};

TabGroupsManager.GroupBarDispHide.prototype.removeContentClickEvent = function()
{
  var contentArea = document.getAnonymousElementByAttribute(document.getElementById("content"), "anonid", "panelcontainer");
  contentArea.removeEventListener("click", this.contentAreaClick, false);
};

TabGroupsManager.GroupBarDispHide.prototype.setMouseoverEvent = function()
{
  let eventArea = document.getElementById((TabGroupsManager.preferences.groupBarPosition == 2) ? "browser-bottombox" : "navigator-toolbox");
  eventArea.addEventListener("mouseover", this.onMouseoverToolbox, false);
  eventArea.addEventListener("dragenter", this.onMouseoverToolbox, false);
};

TabGroupsManager.GroupBarDispHide.prototype.removeMouseoverEvent = function()
{
  let eventArea = document.getElementById((TabGroupsManager.preferences.groupBarPosition == 2) ? "browser-bottombox" : "navigator-toolbox");
  eventArea.removeEventListener("mouseover", this.onMouseoverToolbox, false);
  eventArea.removeEventListener("dragenter", this.onMouseoverToolbox, false);
};

TabGroupsManager.GroupBarDispHide.prototype.setMouseoutEvent = function()
{
  var contentArea = document.getAnonymousElementByAttribute(document.getElementById("content"), 'anonid', 'panelcontainer');
  contentArea.addEventListener("mouseover", this.onMouseoutToolbox, false);
  contentArea.addEventListener("mouseout", this.onMouseoverToolbox2, false);
};

TabGroupsManager.GroupBarDispHide.prototype.removeMouseoutEvent = function()
{
  var contentArea = document.getAnonymousElementByAttribute(document.getElementById("content"), 'anonid', 'panelcontainer');
  contentArea.removeEventListener("mouseover", this.onMouseoutToolbox, false);
  contentArea.removeEventListener("mouseout", this.onMouseoverToolbox2, false);
};

TabGroupsManager.GroupBarDispHide.prototype.contentAreaClick = function(event)
{
  TabGroupsManager.groupBarDispHide.dispGroupBar = false;
};

TabGroupsManager.GroupBarDispHide.prototype.setDispGroupBar = function(value)
{
  if (!value && document.getElementById("navigator-toolbox").customizing)
  {
    return;
  }
  value = value || false;
  if (value != this.fDispGroupBar)
  {
    this.fDispGroupBar = value;
    TabGroupsManager.utils.setRemoveAttribute(TabGroupsManager.xulElements.groupBar, "collapsed", !this.dispGroupBar);
    if (value)
    {
      TabGroupsManager.allGroups.scrollInActiveGroup();
    }
  }
};

TabGroupsManager.GroupBarDispHide.prototype.toggleDispGroupBar = function()
{
  this.dispGroupBar = !this.fDispGroupBar;
  TabGroupsManager.allGroups.groupbar.selectedItem.focus();
};

TabGroupsManager.GroupBarDispHide.prototype.onMouseoverToolbox = function(event)
{
  let tabBarRect = TabGroupsManager.xulElements.tabBar.getBoundingClientRect();
  if (tabBarRect.top <= event.clientY && event.clientY <= tabBarRect.bottom)
  {
    return;
  }
  TabGroupsManager.groupBarDispHide.dispGroupBar = true;
};

TabGroupsManager.GroupBarDispHide.prototype.onMouseoverToolbox2 = function()
{
  if (this.hideBarTimer != null)
  {
    clearTimeout(this.hideBarTimer);
    this.hideBarTimer = null;
  }
};

TabGroupsManager.GroupBarDispHide.prototype.onMouseoutToolbox = function()
{
  if (this.hideBarTimer != null)
  {
    clearTimeout(this.hideBarTimer);
    this.hideBarTimer = null;
  }
  this.hideBarTimer = setTimeout(function ()
  {
    TabGroupsManager.groupBarDispHide.dispGroupBar = false;
  }, TabGroupsManager.preferences.hideGroupBarByMouseoutTimer);
};

TabGroupsManager.GroupBarDispHide.prototype.dispGroupBarByGroupCount = function()
{
  if (TabGroupsManager.allGroups.childNodes.length != 1)
  {
    if (TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 10)
    {
      this.dispGroupBar = true;
    }
    this.dispGroupBarByTabCount();
  }
};

TabGroupsManager.GroupBarDispHide.prototype.hideGroupBarByGroupCount = function()
{
  if (TabGroupsManager.allGroups.childNodes.length == 1)
  {
    if (TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 2 ||
      TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 8 &&
      TabGroupsManagerJsm.applicationStatus.groupBarIsDisplayedInOtherWindow(window)
    )
    {
      this.dispGroupBar = false;
    }
    this.hideGroupBarByTabCount();
  }
};

TabGroupsManager.GroupBarDispHide.prototype.dispGroupBarByTabCount = function()
{
  if (TabGroupsManager.allGroups.childNodes.length != 1 || gBrowser.mTabContainer.childNodes.length != 1)
  {
    if (TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 5)
    {
      this.dispGroupBar = true;
    }
    if (TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 16)
    {
      TabGroupsManager.xulElements.tabBar.removeAttribute("collapsed");
    }
  }
};

TabGroupsManager.GroupBarDispHide.prototype.hideGroupBarByTabCountDelay = function()
{
  setTimeout(function ()
  {
    TabGroupsManager.groupBarDispHide.hideGroupBarByTabCount()
  }, 0);
};

TabGroupsManager.GroupBarDispHide.prototype.hideGroupBarByTabCount = function()
{
  if (TabGroupsManager.allGroups.childNodes.length == 1 && gBrowser.mTabContainer.childNodes.length == 1)
  {
    if (TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 1 ||
      TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 5 &&
      TabGroupsManagerJsm.applicationStatus.groupBarIsDisplayedInOtherWindow(window)
    )
    {
      this.dispGroupBar = false;
    }
    if (TabGroupsManager.preferences.hideGroupBarByTabGroupCount & 16 &&
      TabGroupsManagerJsm.applicationStatus.groupBarIsDisplayedInOtherWindow(window)
    )
    {
      TabGroupsManager.xulElements.tabBar.setAttribute("collapsed", true);
    }
  }
};

TabGroupsManager.GroupBarDispHide.prototype.saveGroupBarDispHideToSessionStore = function()
{
  try
  {
    TabGroupsManager.session.sessionStore.setWindowValue(window, "TabGroupsManagerGroupBarHide", this.dispGroupBar);
  }
  catch (e)
  {}
};

TabGroupsManager.GroupBarDispHide.prototype.firstStatusOfGroupBarDispHide = function()
{
  let oldStatus = "";
  try
  {
    oldStatus = TabGroupsManager.session.sessionStore.getWindowValue(window, "TabGroupsManagerGroupBarHide");
  }
  catch (e)
  {}
  if (oldStatus != null && oldStatus != "")
  {
    TabGroupsManager.session.sessionStore.deleteWindowValue(window, "TabGroupsManagerGroupBarHide");
    this.dispGroupBar = (oldStatus == "true");
  }
  else
  {
    this.hideGroupBarByGroupCount();
    this.hideGroupBarByTabCountDelay();
  }
};

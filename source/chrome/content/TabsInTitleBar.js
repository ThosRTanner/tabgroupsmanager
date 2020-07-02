/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.TabsInTitleBar = function ()
{
  document.documentElement.addEventListener("DOMAttrModified", this, false);
  document.getElementById("navigator-toolbox").addEventListener("DOMAttrModified", this, false);
  document.getElementById("navigator-toolbox").addEventListener("dblclick", this, true);
  document.getElementById("appmenu-button").addEventListener("dblclick", this, false);
  this.topToolBarBak = this.searchTopToolBar();
};

TabGroupsManager.TabsInTitleBar.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "DOMAttrModified":
    this.onDOMAttrModified(event);
    break;
  case "dblclick":
    this.onDblClick(event);
    break;
  }
};

TabGroupsManager.TabsInTitleBar.prototype.onDOMAttrModified = function (event)
{
  switch (event.attrName)
  {
  case "tabsintitlebar":
    if (event.currentTarget == document.documentElement)
    {
      this.onTabsInTitleBarChanged(event);
    }
    break;
  case "ordinal":
  case "collapsed":
  case "autohide":
    if (event.currentTarget.id == "navigator-toolbox" && event.target.tagName == "toolbar")
    {
      this.onToolBarOrderChanged();
    }
    break;
  }
};

TabGroupsManager.TabsInTitleBar.prototype.onDblClick = function (event)
{
  if (document.documentElement.getAttribute("tabsintitlebar"))
  {
    if (event.currentTarget.id == "appmenu-button" || event.screenY == 0)
    {
      window.restore();
      event.stopPropagation();
      event.preventDefault();
    }
  }
};

TabGroupsManager.TabsInTitleBar.prototype.onToolBarOrderChanged = function ()
{
  let topToolBar = this.searchTopToolBar();
  if (topToolBar != this.topToolBarBak)
  {
    if (document.documentElement.getAttribute("tabsintitlebar"))
    {
      if (topToolBar == TabGroupsManager.xulElements.tabBar)
      {
        this.tabBarSpaceCollapse(false);
      }
      else
      {
        this.adjustToolBarSpace(topToolBar, true);
      }
      if (this.topToolBarBak == TabGroupsManager.xulElements.tabBar)
      {
        this.tabBarSpaceCollapse(true);
      }
      else if (this.topToolBarBak)
      {
        this.adjustToolBarSpace(this.topToolBarBak, false);
      }
    }
    this.topToolBarBak = topToolBar;
  }
};

TabGroupsManager.TabsInTitleBar.prototype.onTabsInTitleBarChanged = function (event)
{
  let topToolBar = this.searchTopToolBar();
  if (topToolBar.id != "TabsToolbar")
  {
    this.adjustTitleBarMargin(topToolBar, event.newValue);
    this.adjustToolBarSpace(topToolBar, event.newValue);
    this.tabBarSpaceCollapse(event.newValue);
  }
  this.topToolBarBak = topToolBar;
};

TabGroupsManager.TabsInTitleBar.prototype.searchTopToolBar = function ()
{
  let toolBox = document.getElementById("navigator-toolbox");
  let topToolBar = null;
  let minY = 9999;
  for (let i = 0; i < toolBox.childNodes.length; i++)
  {
    if (toolBox.childNodes[i].tagName == "toolbar")
    {
      let box = toolBox.childNodes[i].boxObject;
      if (box.height > 0 && box.y < minY)
      {
        minY = box.y;
        topToolBar = toolBox.childNodes[i];
      }
    }
  }
  return topToolBar;
};

TabGroupsManager.TabsInTitleBar.prototype.tabBarSpaceCollapse = function (flag)
{
  let tabsToolBar = TabGroupsManager.xulElements.tabBar;
  for (let i = 0; i < tabsToolBar.childNodes.length; i++)
  {
    let item = tabsToolBar.childNodes[i];
    if (item.tagName == "hbox")
    {
      let type = item.getAttribute("type");
      if (type == "appmenu-button" || type == "caption-buttons")
      {
        TabGroupsManager.utils.setRemoveAttribute(item, "collapsed", flag);
      }
    }
  }
  if (flag)
  {
    tabsToolBar.style.backgroundImage = "none";
  }
  else
  {
    tabsToolBar.style.backgroundImage = "";
  }
};

TabGroupsManager.TabsInTitleBar.prototype.adjustTitleBarMargin = function (topToolBar, flag)
{
  let titleBar = document.getElementById("titlebar");
  titleBar.style.marginBottom = "";
  if (flag)
  {
    let titlebarTop = document.getElementById("titlebar-content").getBoundingClientRect().top;
    let topToolBarBox = topToolBar.getBoundingClientRect();
    titleBar.style.marginBottom = -Math.min(topToolBarBox.top - titlebarTop, topToolBarBox.height) + "px";
  }
};

TabGroupsManager.TabsInTitleBar.prototype.adjustToolBarSpace = function (toolBar, flag)
{
  if (flag)
  {
    toolBar.style.paddingLeft = document.getElementById("appmenu-button-container").boxObject.width + "px";
    toolBar.style.paddingRight = document.getElementById("titlebar-buttonbox-container").boxObject.width + "px";
  }
  else
  {
    toolBar.style.paddingLeft = "";
    toolBar.style.paddingRight = "";
  }
};

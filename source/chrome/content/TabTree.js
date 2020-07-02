/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.TabTree = function (aOwner)
{
  try
  {
    this.owner = aOwner;
    this.parentTab = null;
    this.childTabs = null;
    this.__defineGetter__("outerBackgroundColor", this.getOuterBackgroundColor);
    this.__defineSetter__("outerBackgroundColor", this.setOuterBackgroundColor);
    this.__defineGetter__("innerBackgroundColor", this.getInnerBackgroundColor);
    this.__defineSetter__("innerBackgroundColor", this.setInnerBackgroundColor);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.TabTree.prototype.getOuterBackgroundColor = function ()
{
  return this.owner.style.backgroundColor;
};

TabGroupsManager.TabTree.prototype.setOuterBackgroundColor = function (value)
{
  this.owner.style.backgroundImage = "none";
  this.owner.style.backgroundColor = value;
};

TabGroupsManager.TabTree.prototype.getInnerBackgroundColor = function ()
{
  var tmp = document.getAnonymousElementByAttribute(this.owner, "class", "tab-text");
  if (!tmp)
  {
    tmp = document.getAnonymousElementByAttribute(this.owner, "class", "tab-text tab-label");
  }
  return tmp.style.backgroundColor;
};

TabGroupsManager.TabTree.prototype.setInnerBackgroundColor = function (value)
{
  var tmp = document.getAnonymousElementByAttribute(this.owner, "class", "tab-text");
  if (!tmp)
  {
    tmp = document.getAnonymousElementByAttribute(this.owner, "class", "tab-text tab-label");
  }
  tmp.style.backgroundColor = value;
};

TabGroupsManager.TabTree.prototype.addTabToTree = function (tab, insertIndex)
{
  if (!this.childTabs)
  {
    this.childTabs = new Array();
  }
  if (this.childTabs.length == 0)
  {
    if (insertIndex == null)
    {
      TabGroupsManager.tabMoveByTGM.moveTabTo(tab, this.owner._tPos + 1);
    }
    if (TabGroupsManager.preferences.tabTreeDisplayParentAndChild && this.innerBackgroundColor == "")
    {
      this.innerBackgroundColor = TabGroupsManager.tabOpenStatus.getColor();
    }
  }
  else
  {
    if (insertIndex == null)
    {
      var lastTab = this.searchLastTabInTabToTree(this.childTabs[this.childTabs.length - 1]);
      TabGroupsManager.tabMoveByTGM.moveTabTo(tab, lastTab._tPos + 1);
    }
  }
  if (insertIndex != null)
  {
    this.childTabs.splice(insertIndex, 0, tab);
  }
  else
  {
    this.childTabs.push(tab);
  }
  tab.tabGroupsManagerTabTree = new TabGroupsManager.TabTree(tab);
  tab.tabGroupsManagerTabTree.parentTab = this.owner;
  if (TabGroupsManager.preferences.tabTreeDisplayParentAndChild)
  {
    tab.tabGroupsManagerTabTree.outerBackgroundColor = this.innerBackgroundColor;
  }
};

TabGroupsManager.TabTree.prototype.searchLastTabInTabToTree = function (tab)
{
  var tabTree = tab.tabGroupsManagerTabTree;
  if (tabTree && tabTree.childTabs)
  {
    return tabTree.searchLastTabInTabToTree(tabTree.childTabs[tabTree.childTabs.length - 1]);
  }
  else
  {
    return tab;
  }
};

TabGroupsManager.TabTree.prototype.removeTabFromTree = function (tabClose)
{
  try
  {
    let tab = this.owner;
    let closingSelectedTab = (tabClose && tab == gBrowser.selectedTab) ? tab : null;
    let newTargetTab = null;
    if (this.childTabs && this.childTabs.length > 0)
    {
      newTargetTab = this.childTabs[0];
      newTargetTab.tabGroupsManagerTabTree.outerBackgroundColor = this.outerBackgroundColor;
      newTargetTab.tabGroupsManagerTabTree.innerBackgroundColor = this.innerBackgroundColor;
      if (TabGroupsManager.preferences.tabTreeFocusTabByParentAndChild && closingSelectedTab == gBrowser.selectedTab)
      {
        gBrowser.selectedTab = newTargetTab;
      }
    }
    if (this.parentTab && this.parentTab.tabGroupsManagerTabTree)
    {
      let childTabs = this.parentTab.tabGroupsManagerTabTree.childTabs;
      if (childTabs)
      {
        for (let i = 0; i < childTabs.length; i++)
        {
          if (childTabs[i] == tab)
          {
            childTabs.splice(i, 1);
            if (newTargetTab)
            {
              this.parentTab.tabGroupsManagerTabTree.addTabToTree(newTargetTab, i);
            }
            if (TabGroupsManager.preferences.tabTreeFocusTabByParentAndChild && closingSelectedTab == gBrowser.selectedTab && childTabs.length > 0)
            {
              gBrowser.selectedTab = (i < childTabs.length) ? childTabs[i] : childTabs[i - 1];
            }
          }
        }
        if (childTabs.length == 0)
        {
          if (TabGroupsManager.preferences.tabTreeDisplayParentAndChild)
          {
            this.parentTab.tabGroupsManagerTabTree.innerBackgroundColor = "";
          }
          delete this.parentTab.tabGroupsManagerTabTree.childTabs;
          if (!this.parentTab.tabGroupsManagerTabTree.parentTab)
          {
            delete this.parentTab.tabGroupsManagerTabTree;
          }
          if (TabGroupsManager.preferences.tabTreeFocusTabByParentAndChild && closingSelectedTab == gBrowser.selectedTab)
          {
            gBrowser.selectedTab = this.parentTab;
          }
        }
      }
    }
    if (newTargetTab)
    {
      for (let i = 1; i < this.childTabs.length; i++)
      {
        newTargetTab.tabGroupsManagerTabTree.addTabToTree(this.childTabs[i]);
      }
      if (!newTargetTab.tabGroupsManagerTabTree.childTabs)
      {
        newTargetTab.tabGroupsManagerTabTree.innerBackgroundColor = "";
      }
      delete this.childTabs;
    }
    if (TabGroupsManager.preferences.tabTreeDisplayParentAndChild && !tabClose)
    {
      this.outerBackgroundColor = "";
      this.innerBackgroundColor = "";
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.TabTree.prototype.parentTabIsRemoved = function ()
{
  if (TabGroupsManager.preferences.tabTreeDisplayParentAndChild)
  {
    this.outerBackgroundColor = "";
  }
  this.parentTab = null;
  if (!this.childTabs)
  {
    delete this.owner.tabGroupsManagerTabTree;
  }
};

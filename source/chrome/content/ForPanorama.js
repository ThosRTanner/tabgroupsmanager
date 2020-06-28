/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.ForPanorama = function ()
{
  window.addEventListener("tabviewframeinitialized", this, false);
  window.addEventListener("tabviewhidden", this, false);
};

TabGroupsManager.ForPanorama.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "tabviewframeinitialized":
    this.onTabViewFrameInitialized(event);
    break;
  case "tabviewhidden":
    this.onTabViewHidden(event);
    break;
  }
};

TabGroupsManager.ForPanorama.prototype.onTabViewFrameInitialized = function (event)
{
  TabView._window = TabView._window || TabView._iframe.contentWindow;
  TabGroupsManager.overrideMethod.overrideTabViewFunctions();
};

TabGroupsManager.ForPanorama.prototype.onTabViewShow = function ()
{
  try
  {
    let nonSuspendedGroups = TabGroupsManager.allGroups.makeNonSuspendedGroupsList();
    let panoramaGroups = TabView._window.GroupItems.groupItems.slice(0);
    for (let i = panoramaGroups.length - 1; i >= 0; i--)
    {
      let index = nonSuspendedGroups.indexOf(panoramaGroups[i].TgmGroup);
      if (-1 != index)
      {
        nonSuspendedGroups.splice(index, 1);
        panoramaGroups.splice(i, 1);
      }
    }
    for (let i = panoramaGroups.length; i < nonSuspendedGroups.length; i++)
    {
      let box = {
        left: i * 100,
        top: i * 100,
        width: 300,
        height: 200
      };
      panoramaGroups.push(new TabView._window.GroupItem([],
      {
        bounds: box,
        immediately: true
      }));
    }
    for (let i = panoramaGroups.length - 1; i >= nonSuspendedGroups.length; i--)
    {
      panoramaGroups[i].close();
    }
    for (let i = 0; i < nonSuspendedGroups.length; i++)
    {
      panoramaGroups[i].TgmGroup = nonSuspendedGroups[i];
    }
    for (let i = 0; i < TabView._window.GroupItems.groupItems.length; i++)
    {
      let panoramaGroup = TabView._window.GroupItems.groupItems[i];
      let group = panoramaGroup.TgmGroup;
      for (let j = 0; j < group.tabArray.length; j++)
      {
        this.moveTabToPanoramaGroup(group.tabArray[j], panoramaGroup);
      }
      panoramaGroup.setTitle(group.name);
      if (group.tabViewBounds)
      {
        panoramaGroup.setBounds(group.tabViewBounds, true);
      }
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.ForPanorama.prototype.onTabViewHidden = function (event)
{
  try
  {
    let selectedTabBak = gBrowser.selectedTab;
    let nonSuspendedGroups = TabGroupsManager.allGroups.makeNonSuspendedGroupsList();
    let panoramaGroups = TabView._window.GroupItems.groupItems.slice(0);
    let panoramaOrphanedTabs = TabView._window.GroupItems.getOrphanedTabs ? TabView._window.GroupItems.getOrphanedTabs() : [];
    for (let i = panoramaGroups.length - 1; i >= 0; i--)
    {
      let index = nonSuspendedGroups.indexOf(panoramaGroups[i].TgmGroup);
      if (-1 != index)
      {
        nonSuspendedGroups.splice(index, 1);
        panoramaGroups.splice(i, 1);
      }
    }
    for (let i = nonSuspendedGroups.length; i < panoramaGroups.length + panoramaOrphanedTabs.length; i++)
    {
      nonSuspendedGroups.push(TabGroupsManager.allGroups.openNewGroupCore());
    }
    let i = 0;
    for (i = 0; i < panoramaGroups.length; i++)
    {
      panoramaGroups[i].TgmGroup = nonSuspendedGroups[i];
    }
    for (let j = 0; j < panoramaOrphanedTabs.length; j++)
    {
      panoramaOrphanedTabs[j].TgmGroup = nonSuspendedGroups[i + j];
    }
    for (let i = 0; i < TabView._window.GroupItems.groupItems.length; i++)
    {
      let panoramaGroup = TabView._window.GroupItems.groupItems[i];
      let group = panoramaGroup.TgmGroup;
      for (let j = 0; j < panoramaGroup._children.length; j++)
      {
        this.moveTabToGroup(panoramaGroup._children[j].tab, group);
      }
      group.name = panoramaGroup.getTitle();
      group.tabViewBounds = {
        left: panoramaGroup.bounds.left,
        top: panoramaGroup.bounds.top,
        width: panoramaGroup.bounds.width,
        height: panoramaGroup.bounds.height
      };
    }
    for (let i = 0; i < panoramaOrphanedTabs.length; i++)
    {
      let orphanedTab = panoramaOrphanedTabs[i];
      let group = orphanedTab.TgmGroup;
      this.moveTabToGroup(orphanedTab.tab, group);
      group.autoRenameBak = null;
      group.autoRename(orphanedTab.tab.label);
      group.tabViewBounds = {
        left: orphanedTab.bounds.left,
        top: orphanedTab.bounds.top,
        width: orphanedTab.bounds.width,
        height: orphanedTab.bounds.height
      };
    }
    nonSuspendedGroups = TabGroupsManager.allGroups.makeNonSuspendedGroupsList();
    for (let i = 0; i < nonSuspendedGroups.length; i++)
    {
      if (nonSuspendedGroups[i].tabArray.length == 0)
      {
        nonSuspendedGroups[i].close();
      }
    }
    gBrowser.selectedTab = selectedTabBak;
    TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.ForPanorama.prototype.moveTabToPanoramaGroup = function (tab, panoramaGroupItem)
{
  let tabItem = tab._tabViewTabItem;
  if (tabItem.parent)
  {
    tabItem.parent.remove(tabItem,
    {
      dontClose: true,
      immediately: true
    });
  }
  panoramaGroupItem.add(tabItem,
  {
    immediately: true
  });
};

TabGroupsManager.ForPanorama.prototype.moveTabToGroup = function (tab, group)
{
  tab.group.removeTab(tab, undefined, true);
  group.addTab(tab);
};

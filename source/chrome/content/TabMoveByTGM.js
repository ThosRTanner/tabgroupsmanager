/*jshint browser: true, devel: true */
/*eslint-env browser */
/* globals TabGroupsManager */

TabGroupsManager.tabMoveByTGM = {
  tabMovingByTGM: false,

  cancelTabMoveEventOfTreeStyleTab: false,

  moveTabTo: function(tab, to)
  {
    this.tabMovingByTGM = true;
    var backupNextTabOfTMP = gBrowser.mTabContainer.nextTab;
    try
    {
      gBrowser.moveTabTo(tab, to);
    }
    finally
    {
      this.tabMovingByTGM = false;
      if (backupNextTabOfTMP)
      {
        gBrowser.mTabContainer.nextTab = backupNextTabOfTMP;
      }
    }
  },

  moveTabToWithoutTST: function(tab, to)
  {
    if ("treeStyleTab" in gBrowser)
    {
      gBrowser.treeStyleTab.partTab(tab);
    }
    this.cancelTabMoveEventOfTreeStyleTab = true;
    try
    {
      this.moveTabTo(tab, to);
    }
    finally
    {
      this.cancelTabMoveEventOfTreeStyleTab = false;
    }
  }
};

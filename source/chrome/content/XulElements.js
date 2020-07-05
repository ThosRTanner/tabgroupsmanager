/*jshint browser: true, devel: true */
/*eslint-env browser */
/* globals TabGroupsManager */

TabGroupsManager.XulElements = function()
{
  this.groupBar = document.getElementById("TabGroupsManagerToolbar");
  this.groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  this.tabBar = document.getElementById("TabsToolbar");
  if (!this.tabBar)
  {
    this.tabBar = TabGroupsManager.utils.getElementByIdAndAnonids("content", "strip");
  }
};

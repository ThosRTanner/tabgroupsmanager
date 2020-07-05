/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.TabOpenStatus = function()
{
  try
  {
    this.colorArray = ["Orange", "Lavenderblush", "aqua", "PeachPuff", "yellow", "lime", "Gold", "white", "Turquoise", "DarkKhaki", "SandyBrown", "DarkTurquoise", "Khaki", "BurlyWood", "LemonChiffon", "GreenYellow", "SpringGreen", "Aquamarine", "Pink", "Lavender"];
    this.colorIndex = -1;
    this.openerDOMWindow = null;
    this.openerTab = null;
    this.openerContext = null;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.TabOpenStatus.prototype.getColor = function()
{
  this.colorIndex = (this.colorIndex + 1) % this.colorArray.length;
  return this.colorArray[this.colorIndex];
};

TabGroupsManager.TabOpenStatus.prototype.clearOpenerData = function()
{
  this.openerDOMWindow = null;
  this.openerContext = null;
  this.openerTab = null;
};

TabGroupsManager.TabOpenStatus.prototype.setOpenerData = function(aOpener, aContext)
{
  this.openerDOMWindow = aOpener;
  this.openerContext = aContext;
  this.openerTab = TabGroupsManager.utils.getTabFromDOMWindow(aOpener);
};

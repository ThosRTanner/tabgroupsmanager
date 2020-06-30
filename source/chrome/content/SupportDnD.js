/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.SupportDnD = function ()
{
  try
  {
    this.dropAllow = document.getElementById("TabGroupsManagerGroupBarDropAllow");
    this.dropPlus = document.getElementById("TabGroupsManagerGroupBarDropPlus");
    this.dropPlusNewGroup = document.getElementById("TabGroupsManagerGroupBarDropPlusNewGroup");
    this.dropZZZ = document.getElementById("TabGroupsManagerGroupBarDropZZZ");
    this.dropSuspend = document.getElementById("TabGroupsManagerDropSuspend");
    this.icons = new Array();
    this.icons.push(this.dropAllow);
    this.icons.push(this.dropPlus);
    this.icons.push(this.dropPlusNewGroup);
    this.icons.push(this.dropZZZ);
    this.icons.push(this.dropSuspend);
    this.displayIconTimer = null;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.SupportDnD.prototype.getDragElementByParent = function (element, parent)
{
  while (element)
  {
    var nextElement = element.parentNode;
    if (nextElement == parent)
    {
      return element;
    }
    element = nextElement;
  }
  return null;
};

TabGroupsManager.SupportDnD.prototype.getDragElementByTagName = function (element, tagName)
{
  var xulTagName = "xul:" + tagName;
  while (element)
  {
    if (element.tagName == tagName || element.tagName == xulTagName)
    {
      return element;
    }
    element = element.parentNode;
  }
  return null;
};

TabGroupsManager.SupportDnD.prototype.setAllowPositionX = function (positionX)
{
  this.dropAllow.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropAllow);
};

TabGroupsManager.SupportDnD.prototype.setPlusPositionX = function (positionX)
{
  this.dropPlus.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropPlus);
};

TabGroupsManager.SupportDnD.prototype.setPlusOPositionX = function (positionX, ctrlKey)
{
  this.dropPlusNewGroup.style.left = positionX + "px";
  if (ctrlKey != undefined)
  {
    this.dropAllow.style.left = (positionX + 16) + "px";
    this.dropPlus.style.left = (positionX + 16) + "px";
    this.selectDisplayIconTimer(this.dropPlusNewGroup, ctrlKey ? this.dropPlus : this.dropAllow);
  }
  else
  {
    this.selectDisplayIconTimer(this.dropPlusNewGroup);
  }
};

TabGroupsManager.SupportDnD.prototype.setZZZPosition = function (positionX, positionY)
{
  this.dropZZZ.style.left = positionX + "px";
  this.dropZZZ.style.top = positionY + "px";
  this.selectDisplayIconTimer(this.dropZZZ);
};

TabGroupsManager.SupportDnD.prototype.setZZZPositionX = function (positionX)
{
  this.dropZZZ.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropZZZ);
};

TabGroupsManager.SupportDnD.prototype.setSuspendPositionX = function (positionX)
{
  this.dropSuspend.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropSuspend);
};

TabGroupsManager.SupportDnD.prototype.stopDisplayTimer = function ()
{
  if (('undefined' !== typeof this.displayIconTimer) && (this.displayIconTimer))
  {
    clearTimeout(this.displayIconTimer);
  }
  this.displayIconTimer = null;
};

TabGroupsManager.SupportDnD.prototype.selectDisplayIcon = function (displayIconList)
{
  this.stopDisplayTimer();
  for (let i = 0; i < this.icons.length; i++)
  {
    this.icons[i].hidden = (-1 == displayIconList.indexOf(this.icons[i]));
  }
};

TabGroupsManager.SupportDnD.prototype.selectDisplayIconTimer = function ()
{
  this.stopDisplayTimer();
  let displayIconList = new Array();
  for (let i = 0; i < arguments.length; i++)
  {
    displayIconList.push(arguments[i]);
  }
  this.displayIconTimer = setTimeout(function (_this)
  {
    _this.selectDisplayIcon(displayIconList);
  }, 0, this);
};

TabGroupsManager.SupportDnD.prototype.hideAllNow = function ()
{
  this.hideAllNowCore();
  this.hideAll();
};

TabGroupsManager.SupportDnD.prototype.hideAllNowCore = function ()
{
  this.stopDisplayTimer();
  if (('undefined' !== typeof this.icons) && (this.icons))
  {
    for (let i = 0; i < this.icons.length; i++)
    {
      this.icons[i].hidden = true;
    }
  }
};

TabGroupsManager.SupportDnD.prototype.hideAll = function ()
{
  this.stopDisplayTimer();
  this.displayIconTimer = setTimeout(function (_this)
  {
    _this.hideAllNowCore();
  }, 0, this);
};

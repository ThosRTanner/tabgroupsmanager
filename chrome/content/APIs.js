/*
//-----------------------------------------------------------------------------
// Reference for API of "TabGroups Manager"
//-----------------------------------------------------------------------------
object name : TabGroupsManagerApiVer1
property
	visibleTabs
		Array of tabs in selected Group
		return : Array object
		You can use this instead of gBrowser.mTabContainer.childNodes

	firstTab
		First tab in selected Group
		return : tab object
		You can use this instead of gBrowser.mTabContainer.firstChild

	lastTab
		Last tab in selected Group
		return : tab object
		You can use this instead of gBrowser.mTabContainer.lastChild

	firstTabOrNull
		First tab in selected Group or null
		return : tab object or null(before initialize of TGM, after finalize of TGM)

	lastTabOrNull
		First tab in selected Group or null
		return : tab object or null(before initialize of TGM, after finalize of TGM)

	hiddenTabsLength
		number of hidden tabs (number of tabs not in selected Group)
		return : number

	tabMovingByTGM
		The add-ons that use "tabmove" event can know the reason for moving tab by seeing this property.
		return : bool
			true  : The tab is being moved by not hand power but TGM.
			false : The tab is being moved by the method other than TGM.

function
	isTabInSelectedGroup(tab)
		examined whether the tab is in the selected Group
		true  : The tab is in selected Group.
		false : The tab is in other Group.

	getPreviousTabInGroup(tab)
		get previous tab in Group
		tab : tab object
		return : tab object or null(previous tab not exists)

	getNextTabInGroup(tab)
		get previous tab in Group
		tab : tab object
		return : tab object or null(next tab not exists)

	getIndexInGroupFromTab(tab)
		get index in Group form tab
		tab : tab object
		return : number ( -1 : tab does not belong to any Group )

	getIndexInSelectedGroupFromTab(tab)
		get index in selected Group form tab
		tab : tab object
		return : number ( -1 : tab does not belong to selected Group )

	getIndexInGroupFrom_tPos(tPos)
		get index in Group form tPos
		tPos : index of tab ( tab._tPos )
		return : number ( -1 : tab does not belong to any Group )

	getIndexInSelectedGroupFrom_tPos(tPos)
		get index in selected Group form tPos
		tPos : index of tab ( tab._tPos )
		return : number ( -1 : tab does not belong to selected Group )

//-----------------------------------------------------------------------------
object name : TabGroupsManagerApiForTMPVer1
  property
	firstTabVisible
		first tab in Group displayed on the screen
		return:bool	(false = scroll out)

	lastTabVisible
		last tab in Group displayed on the screen
		return:bool	(false = scroll out)

//-----------------------------------------------------------------------------
// usage
//-----------------------------------------------------------------------------
Please use the following formats when there is a possibility that TGM is not installed.

	var firstTab = gBrowser.mTabConatiner.firstChild;
		is able to replace by 
	var firstTab = ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.firstTab : gBrowser.mTabConatiner.firstChild;

	var lastTab = gBrowser.mTabConatiner.lastChild;
		is able to replace by 
	var lastTab = ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.lastTab : gBrowser.mTabConatiner.lastChild;
etc.

//-------------------------------------------------------------------------
// If you want to use it more easily, you can include the object as follows in your add-on.
//-------------------------------------------------------------------------
var [Please select the name that doesn't duplicate] = {

	get visibleTabs() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.visibleTabs : gBrowser.mTabContainer.childNodes;
	},

	get firstTab() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.firstTab : gBrowser.mTabContainer.firstChild;
	},

	get lastTab() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.lastTab : gBrowser.mTabContainer.lastChild;
	},

	get firstTabOrNull() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.firstTabOrNull : null;
	},

	get lastTabOrNull() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.lastTabOrNull : null;
	},

	get hiddenTabsLength() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.hiddenTabsLength : 0;
	},

	get tabMovingByTGM() {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.tabMovingByTGM : false;
	},

	isTabInSelectedGroup : function(tab) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.isTabInSelectedGroup(tab) : true;
	},

	getPreviousTabInGroup : function(tab) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.getPreviousTabInGroup(tab) : tab.previousSibling;
	},

	getNextTabInGroup : function(tab) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.getNextTabInGroup(tab) : tab.nextSibling;
	},

	getIndexInGroupFromTab : function(tab) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.getIndexInGroupFromTab(tab) : tab._tPos;
	},

	getIndexInSelectedGroupFromTab : function(tab) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.getIndexInSelectedGroupFromTab(tab) : tab._tPos;
	},

	getIndexInGroupFrom_tPos : function(tPos) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.getIndexInGroupFrom_tPos(tab) : _tPos;
	},

	getIndexInSelectedGroupFrom_tPos : function(tPos) {
		return ( "TabGroupsManagerApiVer1" in window ) ? TabGroupsManagerApiVer1.getIndexInSelectedGroupFrom_tPos(tab) : _tPos;
	},
};
//-------------------
// usage of the object
//-------------------
	var firstTab = gBrowser.mTabConatiner.firstChild;
		is able to replace by 
	var firstTab = objectName.firstTab;

	var lastTab = gBrowser.mTabConatiner.lastChild;
		is able to replace by 
	var lastTab = objectName.lastTab;
etc.

//-----------------------------------------------------------------------------
var [Please select the name that doesn't duplicate] = {

	get firstTabVisible() {
		return ( "TabGroupsManagerApiForTMPVer1" in window ) ? TabGroupsManagerApiForTMPVer1.firstTabVisible : gBrowser.mTabContainer.isTabVisible(0);
	},

	get lastTabVisible() {
		return ( "TabGroupsManagerApiForTMPVer1" in window ) ? TabGroupsManagerApiForTMPVer1.lastTabVisible : gBrowser.mTabContainer.lastTabVisible;
	},
};
//-------------------
// usage of the object
//-------------------
	if ( gBrowser.mTabContainer.isTabVisible(0) )
		is able to replace by 
	if ( objectName.firstTabVisible )

	if ( gBrowser.mTabContainer.lastTabVisible )
		is able to replace by 
	if ( objectName.lastTabVisible )
etc.
*/


//-----------------------------------------------------------------------------
// code
//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// This is API of "TabGroups Manager"
//-----------------------------------------------------------------------------
var TabGroupsManagerApiVer1 = {

	//-------------------------------------------------------------------------
	// Array of tabs in selected Group
	//		return : Array object
	//-------------------------------------------------------------------------
	get visibleTabs() {
		try {
			if (TabGroupsManager.apiEnabled) {
				TabGroupsManager.allGroups.selectedGroup.sortTabArrayByTPos();
				return TabGroupsManager.allGroups.selectedGroup.tabArray;
			}
			return gBrowser.mTabContainer.childNodes;
		} catch (e) {
			return gBrowser.mTabContainer.childNodes;
		}
	},

	//-------------------------------------------------------------------------
	// First tab in selected Group
	//		return : tab object
	//		You can use this instead of gBrowser.mTabContainer.firstChild
	//-------------------------------------------------------------------------
	get firstTab() {
		try {
			var tab = this.firstTabOrNull;
			return ( tab != null ) ? tab : gBrowser.mTabContainer.firstChild;
		} catch(e) {
			return gBrowser.mTabContainer.firstChild;
		}
	},

	//-------------------------------------------------------------------------
	// Last tab in selected Group
	//		return : tab object
	//		You can use this instead of gBrowser.mTabContainer.lastChild
	//-------------------------------------------------------------------------
	get lastTab() {
		try {
			var tab = this.lastTabOrNull;
			return ( tab != null ) ? tab : gBrowser.mTabContainer.lastChild;
		} catch(e) {
			return gBrowser.mTabContainer.lastChild;
		}
	},

	//-------------------------------------------------------------------------
	// First tab in selected Group or null
	//		return:tab object or null(before initialize of TGM, after finalize of TGM)
	//-------------------------------------------------------------------------
	get firstTabOrNull() {
		try {
			if (TabGroupsManager.apiEnabled) {
				return TabGroupsManager.allGroups.selectedGroup.getFirstTabInGroup();
			}
			return null;
		} catch (e) {
			return null;
		}
	},

	//-------------------------------------------------------------------------
	// First tab in selected Group or null
	//		return:tab object or null(before initialize of TGM, after finalize of TGM)
	//-------------------------------------------------------------------------
	get lastTabOrNull() {
		try {
			if (TabGroupsManager.apiEnabled) {
				return TabGroupsManager.allGroups.selectedGroup.getLastTabInGroup();
			}
			return null;
		} catch (e) {
			return null;
		}
	},

	//-------------------------------------------------------------------------
	// number of hidden tabs (number of tabs not in selected Group)
	//		return:number
	//-------------------------------------------------------------------------
	get hiddenTabsLength() {
		try {
			if (TabGroupsManager.apiEnabled) {
				return gBrowser.mTabContainer.childNodes.length - TabGroupsManagerApiVer1.visibleTabs.length;
			}
			return 0;
		} catch (e) {
			return 0;
		}
	},

	//-------------------------------------------------------------------------
	// The add-ons that use "tabmove" event can know the reason for moving tab by seeing this property.
	//		true  : The tab is being moved by not hand power but TGM.
	//		false : The tab is being moved by the method other than TGM.
	//-------------------------------------------------------------------------
	get tabMovingByTGM() {
		try {
			return TabGroupsManager.tabMoveByTGM.tabMovingByTGM;
		} catch (e) {
			return false;
		}
	},

	//-------------------------------------------------------------------------
	// examined whether the tab is in the selected Group.
	//		true  : The tab is in selected Group.
	//		false : The tab is in other Group.
	//-------------------------------------------------------------------------
	isTabInSelectedGroup : function(tab) {
		try {
			if (TabGroupsManager.apiEnabled) {
				return tab.group.selected;
			}
			return true;
		} catch (e) {
			return true;
		}
	},

	//-------------------------------------------------------------------------
	// get previous tab in Group
	//		tab : tab object
	//		return : tab object or null(previous tab not exists)
	//-------------------------------------------------------------------------
	getPreviousTabInGroup : function(tab) {
		try {
			if (TabGroupsManager.apiEnabled) {
				return tab.group.getPreviousTabInGroup(tab);
			}
			return tab.previousSibling;
		} catch (e) {
			return null;
		}
	},

	//-------------------------------------------------------------------------
	// get next tab in Group
	//		tab : tab object
	//		return : tab object or null(next tab not exists)
	//-------------------------------------------------------------------------
	getNextTabInGroup : function(tab) {
		try {
			if (TabGroupsManager.apiEnabled) {
				return tab.group.getNextTabInGroup(tab);
			}
			return tab.nextSibling;
		} catch (e) {
			return null;
		}
	},

	//-------------------------------------------------------------------------
	// get index in Group form tab and Group
	//		tab : tab object
	//		return : number ( -1 : tab does not belong to Group )
	//		before initialize TGM : return : tab._tPos
	//-------------------------------------------------------------------------
	getIndexInGroupFromTabAndGroup : function(tab, group) {
		try {
			if (!tab || !tab.parentNode) {
				return -1;
			} else if (TabGroupsManager.apiEnabled) {
				return group ? group.tabArray.indexOf(tab) : -1;
			}
			return tab._tPos;
		} catch (e) {
			return -1;
		}
	},

	//-------------------------------------------------------------------------
	// get index in Group form tab
	//		tab : tab object
	//		return : number ( -1 : tab does not belong to any Group )
	//-------------------------------------------------------------------------
	getIndexInGroupFromTab : function(tab) {
		try {
			return this.getIndexInGroupFromTabAndGroup(tab, tab.group);
		} catch (e) {
			return -1;
		}
	},

	//-------------------------------------------------------------------------
	// get index in Group form tab
	//		tab : tab object
	//		return : number ( -1 : tab does not belong to selected Group )
	//-------------------------------------------------------------------------
	getIndexInSelectedGroupFromTab : function(tab) {
		try {
			return this.getIndexInGroupFromTabAndGroup(tab, TabGroupsManager.allGroups.selectedGroup);
		} catch (e) {
			return -1;
		}
	},

	//-------------------------------------------------------------------------
	// get index in Group form tab
	//		tPos : index of tab ( tab._tPos )
	//		return : number ( -1 : tab does not belong to any Group )
	//-------------------------------------------------------------------------
	getIndexInGroupFrom_tPos : function(tPos) {
		try {
			if (TabGroupsManager.apiEnabled) {
				return this.getIndexInGroupFromTab(gBrowser.mTabContainer.childNodes[tPos]);
			}
			return tPos;
		} catch (e) {
			return -1;
		}
	},

	//-------------------------------------------------------------------------
	// get index in selected Group form _tPos
	//		tPos : index of tab ( tab._tPos )
	//		return : number ( -1 : tab does not belong to selected Group )
	//-------------------------------------------------------------------------
	getIndexInSelectedGroupFrom_tPos : function(tPos) {
		try {
			if (TabGroupsManager.apiEnabled) {
				return this.getIndexInSelectedGroupFromTab(gBrowser.mTabContainer.childNodes[tPos]);
			}
			return tPos;
		} catch (e) {
			return -1;
		}
	},
};
//-----------------------------------------------------------------------------
// This is API of "TabGroups Manager" for "Tab Mix Plus"(require "Tab Mix Plus")
//-----------------------------------------------------------------------------
var TabGroupsManagerApiForTMPVer1 = {

	//-------------------------------------------------------------------------
	// first tab in Group displayed on the screen
	//		return:bool	(false = scroll out)
	//-------------------------------------------------------------------------
	get firstTabVisible() {
		try {
			if (TabGroupsManager.apiEnabled) {
				return TabGroupsManager.allGroups.selectedGroup.getFirstTabVisible();	// require "Tab Mix Plus"
			}
			return gBrowser.mTabContainer.isTabVisible(0);
		} catch (e) {
			return true;
		}
	},

	//-------------------------------------------------------------------------
	// last tab in Group displayed on the screen
	//		return:bool	(false = scroll out)
	//-------------------------------------------------------------------------
	get lastTabVisible() {
		try {
			if (TabGroupsManager.apiEnabled) {
				return TabGroupsManager.allGroups.selectedGroup.getLastTabVisible();	// require "Tab Mix Plus"
			}
			return gBrowser.mTabContainer.lastTabVisible;
		} catch (e) {
			return true;
		}
	},
};
//-----------------------------------------------------------------------------

/*global QUnit*/

QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/fl/FlexController",
	"sap/ui/fl/Change",
	"sap/ui/fl/registry/ChangeRegistry",
	"sap/ui/fl/Persistence",
	"sap/ui/core/Control",
	"sap/ui/fl/Utils",
	"sap/ui/fl/changeHandler/HideControl",
	"sap/ui/fl/ChangePersistenceFactory",
	"sap/ui/fl/changeHandler/JsControlTreeModifier",
	"sap/ui/fl/changeHandler/XmlTreeModifier",
	"sap/ui/fl/context/ContextManager",
	"sap/ui/thirdparty/sinon",
	"sap/ui/thirdparty/sinon-qunit"
],
function (
	FlexController,
	Change,
	ChangeRegistry,
	Persistence,
	Control,
	Utils,
	HideControl,
	ChangePersistenceFactory,
	JsControlTreeModifier,
	XmlTreeModifier,
	ContextManager,
	sinon
) {
	'use strict';
	QUnit.start();

	sinon.config.useFakeTimers = false;

	jQuery.sap.registerModulePath("testComponent", "./testComponent");

	var sandbox = sinon.sandbox.create();

	var oComponent = sap.ui.getCore().createComponent({
		name: "testComponent",
		id: "testComponent",
		"metadata": {
			"manifest": "json"
		}
	});

	var getLabelChangeContent = function(sFileName, sSelectorId) {
		return {
			"fileType": "change",
			"layer": "USER",
			"fileName": sFileName || "a",
			"namespace": "b",
			"packageName": "c",
			"changeType": "labelChange",
			"creation": "",
			"reference": "",
			"selector": {
				"id": sSelectorId || "abc123"
			},
			"content": {
				"something": "createNewVariant"
			}
		};
	};

	var labelChangeContent = getLabelChangeContent("a");
	var labelChangeContent2 = getLabelChangeContent("a2");
	var labelChangeContent3 = getLabelChangeContent("a3");
	var labelChangeContent4 = getLabelChangeContent("a4", "foo");

	QUnit.module("sap.ui.fl.FlexController", {
		beforeEach: function () {
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");
			this.oControl = new sap.ui.core.Control("existingId");
			this.oChange = new Change(labelChangeContent);
		},
		afterEach: function () {
			sandbox.restore();
			this.oControl.destroy();
			ChangePersistenceFactory._instanceCache = {};
		}
	});

	QUnit.test("shall be instantiable", function (assert) {
		assert.ok(this.oFlexController);
	});

	QUnit.test('createAndApplyChange shall not crash if no change handler can be found', function (assert) {
		var oUtilsLogStub = this.stub(Utils.log, "warning");
		var oChangeSpecificData = {};
		var oControlType = {};
		var oControl = {};
		var oChange = {};

		this.stub(this.oFlexController, "_getChangeHandler").returns(undefined);
		this.stub(JsControlTreeModifier, "getControlType").returns(oControlType);
		this.stub(this.oFlexController, "addChange").returns(oChange);

		this.oFlexController.createAndApplyChange(oChangeSpecificData, oControl);
		assert.ok(oUtilsLogStub.calledOnce, "a warning was logged");
	});

	QUnit.test('_resolveGetChangesForView does not crash, if change can be created and applied', function (assert) {
		this.oChange = new Change(labelChangeContent);

		var oSelector = {};
		oSelector.id = "id";

		this.oChange.selector = oSelector;
		this.oChange.getSelector = function(){return oSelector;};

		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub = sinon.stub();

		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "myapp"
			}
		});

		this.stub(this.oFlexController, "_writeCustomData");
		this.stub(this.oFlexController, "_getChangeHandler").returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub
		});

		this.stub(JsControlTreeModifier, "bySelector").returns({});
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [this.oChange])

		.then(function() {
			sinon.assert.called(changeHandlerApplyChangeStub);
		});
	});

	QUnit.test("_resolveGetChangesForView does not crash and logs an error if no changes were passed", function (assert) {
		var mPropertyBagStub = {
			unmergedChangesOnly: true
		};
		var oUtilsLogStub = this.stub(Utils.log, "error");

		var aResolveArray = this.oFlexController._resolveGetChangesForView(mPropertyBagStub, "thisIsNoArray");
		assert.ok(oUtilsLogStub.calledOnce, "a error was logged");
		assert.equal(aResolveArray.length, 0, "an empty array was returned");

	});

	QUnit.test('_resolveGetChangesForView applies changes with locale id', function (assert) {
		this.oChange = new Change(labelChangeContent);

		var oSelector = {};
		oSelector.id = "id";
		oSelector.idIsLocal = true;

		this.oChange.selector = oSelector;
		this.oChange.getSelector = function(){return oSelector;};

		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub = sinon.stub();

		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "myapp"
			}
		});

		this.stub(this.oFlexController, "_writeCustomData");
		this.stub(this.oFlexController, "_getChangeHandler").returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub
		});

		var oAppComponent = new sap.ui.core.UIComponent();

		this.stub(JsControlTreeModifier, "bySelector").returns({});
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var oControl = new sap.ui.core.Control("testComponent---localeId");

		var mPropertyBagStub = {
			view: oControl,
			modifier: JsControlTreeModifier,
			appComponent: oAppComponent
		};

		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [this.oChange])

		.then(function() {
			sinon.assert.called(changeHandlerApplyChangeStub);
		});
	});

	QUnit.test("_getChangeRegistryItem shall return the change registry item", function (assert) {
		var sControlType, oChange, oChangeRegistryItem, oChangeRegistryItemActual, fGetRegistryItemStub;
		sControlType = "sap.ui.core.Control";
		oChange = new Change(labelChangeContent);
		oChangeRegistryItem = {};
		fGetRegistryItemStub = sinon.stub().returns(oChangeRegistryItem);
		sinon.stub(this.oFlexController, "_getChangeRegistry").returns({getRegistryItems: fGetRegistryItemStub});

		//Call CUT
		oChangeRegistryItemActual = this.oFlexController._getChangeRegistryItem(oChange, sControlType);

		assert.strictEqual(oChangeRegistryItemActual, oChangeRegistryItem);
		sinon.assert.calledOnce(fGetRegistryItemStub);
		assert.strictEqual(fGetRegistryItemStub.getCall(0).args[0].changeTypeName, "labelChange");
		assert.strictEqual(fGetRegistryItemStub.getCall(0).args[0].controlType, "sap.ui.core.Control");
		assert.strictEqual(fGetRegistryItemStub.getCall(0).args[0].layer, "USER");
	});

	QUnit.test("_getChangeHandler shall retrieve the ChangeTypeMetadata and extract the change handler", function (assert) {
		var fChangeHandler, fChangeHandlerActual;

		fChangeHandler = sinon.stub();
		sinon.stub(this.oFlexController, "_getChangeTypeMetadata").returns({getChangeHandler: sinon.stub().returns(fChangeHandler)});

		//Call CUT
		fChangeHandlerActual = this.oFlexController._getChangeHandler(this.oChange, this.oControl);

		assert.strictEqual(fChangeHandlerActual, fChangeHandler);
	});

	QUnit.test("_resolveGetChangesForView shall not log if change can be applied", function(assert) {
		// PREPARE
		var oChange = new Change(labelChangeContent);
		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub = sinon.stub().returns(Promise.resolve(true));

		var oLoggerStub = sandbox.stub(jQuery.sap.log, 'error');
		this.stub(this.oFlexController, "_getChangeHandler").returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub
		});
		this.stub(JsControlTreeModifier, "bySelector").returns(undefined);
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		// CUT
		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [oChange])

		.then(function() {
			assert.strictEqual(oLoggerStub.callCount, 0, "No Error was logged");
		});
	});

	QUnit.test("_resolveGetChangesForView continues the processing if an error occurs", function (assert) {
		var oChange = new Change(labelChangeContent);
		var oSelector = {};
		oSelector.id = "id";

		this.oChange.selector = oSelector;
		this.oChange.getSelector = function(){return oSelector;};

		var mPropertyBagStub = {};
		var oLoggingStub = sandbox.stub(jQuery.sap.log, "warning");
		var oGetTargetControlStub = sandbox.stub(this.oFlexController, "_getSelectorOfChange").returns(undefined);

		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [oChange, oChange])

		.then(function() {
			assert.strictEqual(oGetTargetControlStub.callCount, 2, "all changes  were processed");
			assert.ok(oLoggingStub.calledTwice, "the issues were logged");
		});
	});

	QUnit.test("_resolveGetChangesForView process the applyChange promises in the correct order (async, async, async)", function (assert) {
		var oChange = new Change(labelChangeContent);
		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub0 = sinon.stub().returns(Promise.resolve(true));
		var changeHandlerApplyChangeStub1 = sinon.stub().returns(Promise.resolve(true));
		var changeHandlerApplyChangeStub2 = sinon.stub().returns(Promise.resolve(true));

		var oLoggerStub = sandbox.stub(jQuery.sap.log, 'error');
		var oGetChangeHandlerStub = this.stub(this.oFlexController, "_getChangeHandler");
		oGetChangeHandlerStub.onCall(0).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub0
		});
		oGetChangeHandlerStub.onCall(1).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub1
		});
		oGetChangeHandlerStub.onCall(2).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub2
		});
		this.stub(JsControlTreeModifier, "bySelector").withArgs(sinon.match.defined).returns({});
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		// CUT
		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [oChange, oChange, oChange])

		.then(function() {
			sinon.assert.callOrder(changeHandlerApplyChangeStub0, changeHandlerApplyChangeStub1, changeHandlerApplyChangeStub2);
			assert.strictEqual(oLoggerStub.callCount, 0, "No Error was logged");
		});
	});

	QUnit.test("_resolveGetChangesForView process the applyChange promises in the correct order (sync, sync, sync)", function (assert) {
		var oChange = new Change(labelChangeContent);
		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub0 = sinon.stub().returns(true);
		var changeHandlerApplyChangeStub1 = sinon.stub().returns(true);
		var changeHandlerApplyChangeStub2 = sinon.stub().returns(true);

		var oLoggerStub = sandbox.stub(jQuery.sap.log, 'error');
		var oGetChangeHandlerStub = this.stub(this.oFlexController, "_getChangeHandler");
		oGetChangeHandlerStub.onCall(0).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub0
		});
		oGetChangeHandlerStub.onCall(1).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub1
		});
		oGetChangeHandlerStub.onCall(2).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub2
		});
		this.stub(JsControlTreeModifier, "bySelector").withArgs(sinon.match.defined).returns({});
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		// CUT
		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [oChange, oChange, oChange])

		.then(function() {
			sinon.assert.callOrder(changeHandlerApplyChangeStub0, changeHandlerApplyChangeStub1, changeHandlerApplyChangeStub2);
			assert.strictEqual(oLoggerStub.callCount, 0, "No Error was logged");
		});
	});

	QUnit.test("_resolveGetChangesForView process the applyChange promises in the correct order (sync, async, async)", function (assert) {
		var oChange = new Change(labelChangeContent);
		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub0 = sinon.stub().returns(true);
		var changeHandlerApplyChangeStub1 = sinon.stub().returns(Promise.resolve(true));
		var changeHandlerApplyChangeStub2 = sinon.stub().returns(Promise.resolve(true));

		var oLoggerStub = sandbox.stub(jQuery.sap.log, 'error');
		var oGetChangeHandlerStub = this.stub(this.oFlexController, "_getChangeHandler");
		oGetChangeHandlerStub.onCall(0).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub0
		});
		oGetChangeHandlerStub.onCall(1).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub1
		});
		oGetChangeHandlerStub.onCall(2).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub2
		});
		this.stub(JsControlTreeModifier, "bySelector").withArgs(sinon.match.defined).returns({});
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		// CUT
		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [oChange, oChange, oChange])

		.then(function() {
			sinon.assert.callOrder(changeHandlerApplyChangeStub0, changeHandlerApplyChangeStub1, changeHandlerApplyChangeStub2);
			assert.strictEqual(oLoggerStub.callCount, 0, "No Error was logged");
		});
	});

	QUnit.test("_resolveGetChangesForView process the applyChange promises in the correct order (async, sync, async)", function (assert) {
		var oChange = new Change(labelChangeContent);
		var completeChangeContentStub = sinon.stub();
		var changeHandlerApplyChangeStub0 = sinon.stub().returns(Promise.resolve(true));
		var changeHandlerApplyChangeStub1 = sinon.stub().returns(true);
		var changeHandlerApplyChangeStub2 = sinon.stub().returns(Promise.resolve(true));

		var oLoggerStub = sandbox.stub(jQuery.sap.log, 'error');
		var oGetChangeHandlerStub = this.stub(this.oFlexController, "_getChangeHandler");
		oGetChangeHandlerStub.onCall(0).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub0
		});
		oGetChangeHandlerStub.onCall(1).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub1
		});
		oGetChangeHandlerStub.onCall(2).returns({
			completeChangeContent: completeChangeContentStub,
			applyChange: changeHandlerApplyChangeStub2
		});
		this.stub(JsControlTreeModifier, "bySelector").withArgs(sinon.match.defined).returns({});
		this.stub(JsControlTreeModifier, "getControlType").returns("aType");

		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		// CUT
		return this.oFlexController._resolveGetChangesForView(mPropertyBagStub, [oChange, oChange, oChange])

		.then(function() {
			sinon.assert.callOrder(changeHandlerApplyChangeStub0, changeHandlerApplyChangeStub1, changeHandlerApplyChangeStub2);
			assert.strictEqual(oLoggerStub.callCount, 0, "No Error was logged");
		});
	});

	QUnit.test("addChange shall add a change", function(assert) {
		var oControl = new Control("Id1");

		this.stub(Utils, "getAppComponentForControl").returns(oComponent);

		var fChangeHandler = sinon.stub();
		fChangeHandler.applyChange = sinon.stub();
		fChangeHandler.completeChangeContent = sinon.stub();
		sinon.stub(this.oFlexController, "_getChangeHandler").returns(fChangeHandler);

		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "testScenarioComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});

		//Call CUT
		var oChange = this.oFlexController.addChange({}, oControl);
		assert.ok(oChange);


		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForComponent(this.oFlexController.getComponentName(), this.oFlexController._sAppVersion);
		var aDirtyChanges = oChangePersistence.getDirtyChanges();

		assert.strictEqual(aDirtyChanges.length, 1);
		assert.strictEqual(aDirtyChanges[0].getSelector().id, 'Id1');
		assert.strictEqual(aDirtyChanges[0].getNamespace(), 'apps/testScenarioComponent/changes/');
		assert.strictEqual(aDirtyChanges[0].getComponent(), 'testScenarioComponent');
	});

	QUnit.test("createVariant shall create a variant object", function(assert) {
		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "testScenarioComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});

		var oVariantSpecificData = {
			content: {
				fileName: "idOfVariantManagementReference",
				title: "Standard",
				fileType: "variant",
				reference: "Dummy.Component",
				variantManagementReference: "idOfVariantManagementReference"
			}
		};

		var oVariant = this.oFlexController.createVariant(oVariantSpecificData, oComponent);
		assert.ok(oVariant);
		assert.strictEqual(oVariant.isVariant(), true);
		assert.strictEqual(oVariant.getTitle(), "Standard");
		assert.strictEqual(oVariant.getVariantManagementReference(), "idOfVariantManagementReference");
		assert.strictEqual(oVariant.getNamespace(), "apps/Dummy/variants/", "then initial variant content set");
	});

	QUnit.test("addPreparedChange shall add a change to flex persistence", function(assert) {

		this.stub(Utils, "getAppComponentForControl").returns(oComponent);
		var oChange = new Change(labelChangeContent);

		var oPrepChange = this.oFlexController.addPreparedChange(oChange, oComponent);
		assert.ok(oPrepChange);

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForComponent(this.oFlexController.getComponentName(), this.oFlexController.getAppVersion());
		var aDirtyChanges = oChangePersistence.getDirtyChanges();

		assert.strictEqual(aDirtyChanges.length, 1);
		assert.strictEqual(aDirtyChanges[0].getSelector().id, "abc123");
		assert.strictEqual(aDirtyChanges[0].getNamespace(), "b");
	});

	QUnit.test("addPreparedChange shall add a change with variant reference to flex persistence and create a variant change", function(assert) {

		this.stub(Utils, "getAppComponentForControl").returns(oComponent);
		var oChange = new Change(labelChangeContent);
		var oAddChangeStub = sandbox.stub();
		var oRemoveChangeStub = sandbox.stub();

		oChange.setVariantReference("testVarRef");
		var oModel = {
			_addChange: oAddChangeStub,
			_removeChange: oRemoveChangeStub,
			getVariant: function(){
				return {
					content : {
						fileName: "idOfVariantManagementReference",
						title: "Standard",
						fileType: "variant",
						reference: "Dummy.Component",
						variantManagementReference: "idOfVariantManagementReference"
					}
				};
			},
			bStandardVariantExists: false
		};
		sandbox.stub(oComponent, "getModel").returns(oModel);


		var oPrepChange = this.oFlexController.addPreparedChange(oChange, oComponent);
		assert.ok(oPrepChange);
		assert.ok(oAddChangeStub.calledOnce, "then model's _addChange is called as VariantManagement Change is detected");
		assert.equal(oModel.bStandardVariantExists, true, "the value for bStandardVariantExists has changed");
		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForComponent(this.oFlexController.getComponentName(), this.oFlexController.getAppVersion());
		var aDirtyChanges = oChangePersistence.getDirtyChanges();

		assert.strictEqual(aDirtyChanges.length, 2);
		assert.strictEqual(aDirtyChanges[0].getVariantManagementReference(), "idOfVariantManagementReference");
		assert.strictEqual(aDirtyChanges[0].isVariant(), true);
		assert.strictEqual(aDirtyChanges[1].getSelector().id, "abc123");
		assert.strictEqual(aDirtyChanges[1].getNamespace(), "b");
		assert.strictEqual(aDirtyChanges[1].isVariant(), false);

		this.oFlexController.deleteChange(oPrepChange, oComponent);
		assert.ok(oRemoveChangeStub.calledOnce, "then model's _removeChange is called as VariantManagement Change is detected and deleted");
	});

	QUnit.test("addChange shall add a change and contain the applicationVersion in the connector", function(assert) {
		var oControl = new Control();

		this.stub(Utils, "getAppComponentForControl").returns(oComponent);

		var fChangeHandler = sinon.stub();
		fChangeHandler.applyChange = sinon.stub();
		fChangeHandler.completeChangeContent = sinon.stub();
		sinon.stub(this.oFlexController, "_getChangeHandler").returns(fChangeHandler);

		//Call CUT
		var oChange = this.oFlexController.addChange({}, oControl);
		assert.ok(oChange);


		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForComponent(this.oFlexController.getComponentName(), this.oFlexController.getAppVersion());
		var oCreateStub = sinon.stub();
		oCreateStub.returns(Promise.resolve());
		var oLrepConnectorMock = {
			create: oCreateStub
		};
		oChangePersistence._oConnector = oLrepConnectorMock;

		sinon.stub(oChangePersistence, "_massUpdateCacheAndDirtyState").returns(undefined);

		oChangePersistence.saveDirtyChanges();

		assert.equal(oCreateStub.getCall(0).args[0][0].validAppVersions.creation, "1.2.3");
		assert.equal(oCreateStub.getCall(0).args[0][0].validAppVersions.from, "1.2.3");
	});

	QUnit.test("addChange shall add a change using the local id with respect to the root component as selector", function(assert) {
		var oControl = new Control("testComponent---Id1");

		this.stub(Utils, "getAppComponentForControl").returns(oComponent);

		var fChangeHandler = sinon.stub();
		fChangeHandler.applyChange = sinon.stub();
		fChangeHandler.completeChangeContent = sinon.stub();
		sinon.stub(this.oFlexController, "_getChangeHandler").returns(fChangeHandler);

		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "testScenarioComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});

		//Call CUT
		var oChange = this.oFlexController.addChange({}, oControl);
		assert.ok(oChange);


		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForComponent(this.oFlexController.getComponentName(), this.oFlexController._sAppVersion);
		var aDirtyChanges = oChangePersistence.getDirtyChanges();

		assert.strictEqual(aDirtyChanges.length, 1);
		assert.strictEqual(aDirtyChanges[0].getSelector().id, 'Id1');
		assert.ok(aDirtyChanges[0].getSelector().idIsLocal);
		assert.strictEqual(aDirtyChanges[0].getNamespace(), 'apps/testScenarioComponent/changes/');
		assert.strictEqual(aDirtyChanges[0].getComponent(), 'testScenarioComponent');
	});

	QUnit.test("addChange shall not set transport information", function (assert) {
		var oControl = new Control();
		this.oFlexController._sComponentName = 'myComponent';
		var oChangeParameters = { transport: "testtransport", packageName: "testpackage" };
		var fChangeHandler = sinon.stub();
		fChangeHandler.applyChange = sinon.stub();
		fChangeHandler.completeChangeContent = sinon.stub();
		sinon.stub(this.oFlexController, "_getChangeHandler").returns(fChangeHandler);
		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "myComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});
		this.stub(Utils, "getAppComponentForControl").returns(oComponent);
		var oSetRequestSpy = this.spy(Change.prototype,"setRequest");
		//Call CUT
		var oChange = this.oFlexController.addChange(oChangeParameters, oControl);
		assert.strictEqual(oSetRequestSpy.callCount,0);
		assert.equal(oChange.getPackage(),"$TMP");
	});

	QUnit.test("discardChanges shall delete the changes from the persistence and save the deletion", function(assert) {
		var oChangePersistence = this.oFlexController._oChangePersistence = {
			deleteChange: sinon.stub(),
			saveDirtyChanges: sinon.stub().returns(Promise.resolve())
		};
		var aChanges = [];
		var oChangeContent = {
			fileName: "Gizorillus1",
			layer: "CUSTOMER",
			fileType: "change",
			changeType: "addField",
			originalLanguage: "DE"
		};
		aChanges.push(new Change(oChangeContent));
		oChangeContent.fileName = 'Gizorillus2';
		aChanges.push(new Change(oChangeContent));
		oChangeContent = {
			fileName: "Gizorillus3",
			layer: "VENDOR",
			fileType: "change",
			changeType: "addField",
			originalLanguage: "DE"
		};
		aChanges.push(new Change(oChangeContent));

		return this.oFlexController.discardChanges(aChanges).then(function() {
			sinon.assert.calledTwice(oChangePersistence.deleteChange);
			sinon.assert.calledOnce(oChangePersistence.saveDirtyChanges);
		});
	});

	QUnit.test("discardChanges with personalized only option shall delete the changes from the persistence and save the deletion only for USER layer", function(assert) {
		var oChangePersistence = this.oFlexController._oChangePersistence = {
			deleteChange: sinon.stub(),
			saveDirtyChanges: sinon.stub().returns(Promise.resolve())
		};
		var aChanges = [];
		for (var i = 0; i < 5; i++){
			aChanges.push(new Change({
				fileName: "Gizorillus" + i,
				layer: "CUSTOMER",
				fileType: "change",
				changeType: "addField",
				originalLanguage: "DE"
			}));
		}
		aChanges[0]._oDefinition.layer = "USER";
		aChanges[1]._oDefinition.layer = "USER";
		aChanges[2]._oDefinition.layer = "PARTNER";
		aChanges[3]._oDefinition.layer = "VENDOR";

		return this.oFlexController.discardChanges(aChanges, true).then(function() {
			sinon.assert.calledTwice(oChangePersistence.deleteChange);
			sinon.assert.calledOnce(oChangePersistence.saveDirtyChanges);
		});
	});

	QUnit.test("discardChanges (with array items deletion) with personalized only option shall delete the changes from the persistence and save the deletion only for USER layer", function(assert) {
		var aChanges = [];
		for (var i = 0; i < 6; i++){
			aChanges.push(new Change({
				fileName: "Gizorillus" + i,
				layer: "VENDOR",
				fileType: "change",
				changeType: "addField",
				originalLanguage: "DE"
			}));
		}
		aChanges[0]._oDefinition.layer = "USER";
		aChanges[1]._oDefinition.layer = "USER";
		aChanges[2]._oDefinition.layer = "CUSTOMER";
		aChanges[3]._oDefinition.layer = "CUSTOMER_BASE";
		aChanges[4]._oDefinition.layer = "PARTNER";

		this.oFlexController._oChangePersistence = {
				aChanges: aChanges,
				deleteChange: function(oChange) {
					var nIndexInMapElement = aChanges.indexOf(oChange);
					if (nIndexInMapElement !== -1) {
						aChanges.splice(nIndexInMapElement, 1);
					}
				},
				saveDirtyChanges: sinon.stub().returns(Promise.resolve())
			};

		return this.oFlexController.discardChanges(aChanges, true).then(function() {
			assert.equal(aChanges.length, 4);
		});
	});

	QUnit.test("discardChangesForId without personalized only option shall delete the changes from the persistence and save the deletion only for CUSTOMER layer", function(assert) {
		var aChangesForSomeId = [];
		var i;

		for (i = 0; i < 5; i++) {
			aChangesForSomeId.push(new Change({
				fileName: "Gizorillus" + i,
				layer: "CUSTOMER",
				fileType: "change",
				changeType: "addField",
				originalLanguage: "DE"
			}));
		}
		aChangesForSomeId[0]._oDefinition.layer = "USER";
		aChangesForSomeId[1]._oDefinition.layer = "PARTNER";
		aChangesForSomeId[3]._oDefinition.layer = "VENDOR";

		var aChangesForSomeOtherId = [];
		for (i = 0; i < 5; i++) {
			aChangesForSomeOtherId.push(new Change({
				fileName: "Gizorillus" + i,
				layer: "CUSTOMER",
				fileType: "change",
				changeType: "addField",
				originalLanguage: "DE"
			}));
		}
		aChangesForSomeOtherId[0]._oDefinition.layer = "USER";
		aChangesForSomeOtherId[1]._oDefinition.layer = "USER";
		aChangesForSomeOtherId[2]._oDefinition.layer = "PARTNER";
		aChangesForSomeOtherId[3]._oDefinition.layer = "VENDOR";

		var oDeleteStub = sinon.stub();

		var oChangePersistence = this.oFlexController._oChangePersistence = {
			deleteChange: oDeleteStub,
			saveDirtyChanges: sinon.stub().returns(Promise.resolve()),
			getChangesMapForComponent: function () {
				return {
					mChanges: {
						"someId": aChangesForSomeId,
						"someOtherId": aChangesForSomeOtherId
					}
				};
			}
		};

		return this.oFlexController.discardChangesForId("someId").then(function() {
			assert.ok(oDeleteStub.calledTwice, "two changes were deleted");
			assert.ok(oDeleteStub.calledWith(aChangesForSomeId[2]), "the first customer change for 'someId' was deleted");
			assert.ok(oDeleteStub.calledWith(aChangesForSomeId[4]), "the second customer change for 'someId' was deleted");
			assert.ok(oChangePersistence.saveDirtyChanges.calledOnce, "the deletion was persisted");
		});
	});

	QUnit.test("discardChangesForId with personalized only option shall delete the changes from the persistence and save the deletion only for USER layer", function(assert) {
		var aChangesForSomeId = [];
		var i;

		for (i = 0; i < 5; i++) {
			aChangesForSomeId.push(new Change({
				fileName: "Gizorillus" + i,
				layer: "CUSTOMER",
				fileType: "change",
				changeType: "addField",
				originalLanguage: "DE"
			}));
		}
		aChangesForSomeId[0]._oDefinition.layer = "USER";
		aChangesForSomeId[1]._oDefinition.layer = "PARTNER";
		aChangesForSomeId[2]._oDefinition.layer = "USER";
		aChangesForSomeId[3]._oDefinition.layer = "VENDOR";

		var aChangesForSomeOtherId = [];
		for (i = 0; i < 5; i++) {
			aChangesForSomeOtherId.push(new Change({
				fileName: "Gizorillus" + i,
				layer: "CUSTOMER",
				fileType: "change",
				changeType: "addField",
				originalLanguage: "DE"
			}));
		}
		aChangesForSomeOtherId[0]._oDefinition.layer = "USER";
		aChangesForSomeOtherId[1]._oDefinition.layer = "USER";
		aChangesForSomeOtherId[2]._oDefinition.layer = "PARTNER";
		aChangesForSomeOtherId[3]._oDefinition.layer = "VENDOR";

		var oDeleteStub = sinon.stub();

		var oChangePersistence = this.oFlexController._oChangePersistence = {
			deleteChange: oDeleteStub,
			saveDirtyChanges: sinon.stub().returns(Promise.resolve()),
			getChangesMapForComponent: function () {
				return {
					mChanges: {
						"someId": aChangesForSomeId,
						"someOtherId": aChangesForSomeOtherId
					}
				};
			}
		};

		return this.oFlexController.discardChangesForId("someId", true).then(function() {
			assert.ok(oDeleteStub.calledTwice, "two changes were deleted");
			assert.ok(oDeleteStub.calledWith(aChangesForSomeId[0]), "the first user change for 'someId' was deleted");
			assert.ok(oDeleteStub.calledWith(aChangesForSomeId[2]), "the second user change for 'someId' was deleted");
			assert.ok(oChangePersistence.saveDirtyChanges.calledOnce, "the deletion was persisted");
		});
	});

	QUnit.test("createAndApplyChange shall remove the change from the persistence, if applying the change raised an exception", function (assert) {
		var oControl = new Control();
		var oChangeSpecificData = {
			changeType: "hideControl"
		};

		this.stub(this.oFlexController, "checkTargetAndApplyChange").returns(Promise.reject());
		this.stub(this.oFlexController, "_getChangeHandler").returns(HideControl);
		this.stub(this.oFlexController, "createChange").returns(new Change(oChangeSpecificData));
		this.stub(this.oFlexController._oChangePersistence, "_addPropagationListener");

		return this.oFlexController.createAndApplyChange(oChangeSpecificData, oControl)

		.catch(function() {
			assert.strictEqual(this.oFlexController._oChangePersistence.getDirtyChanges().length, 0, 'Change persistence should have no dirty changes');
		}.bind(this));

	});

	QUnit.test("throws an error of a change should be created but no control was passed", function (assert) {
		assert.throws(function () {
			this.oFlexController.createChange({}, undefined);
		});
	});

	QUnit.test("adds context to the change if provided by the context manager", function (assert) {

		var sProvidedContext = "ctx001";
		var aProvidedContext = [sProvidedContext];
		this.stub(ContextManager, "_getContextIdsFromUrl").returns(aProvidedContext);
		this.stub(Utils, "getAppComponentForControl").returns(oComponent);

		var oDummyChangeHandler = {
				completeChangeContent: function () {}
		};
		var getChangeHandlerStub = this.stub(this.oFlexController, "_getChangeHandler").returns(oDummyChangeHandler);
		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "myComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});

		this.oFlexController.createChange({}, new sap.ui.core.Control());

		sinon.assert.called(getChangeHandlerStub);
		assert.equal(getChangeHandlerStub.callCount,1);
		var oGetChangesHandlerCall = getChangeHandlerStub.getCall(0);
		var oChange = oGetChangesHandlerCall.args[0];
		assert.equal(oChange.getContext() ,sProvidedContext);
	});

	QUnit.test("throws an error if a change is written with more than one design time context active", function (assert) {
		var aProvidedContext = ["aCtxId", "anotherCtxId"];
		this.stub(ContextManager, "_getContextIdsFromUrl").returns(aProvidedContext);

		var oDummyChangeHandler = {
			completeChangeContent: function () {}
		};
		this.stub(this.oFlexController, "_getChangeHandler").returns(oDummyChangeHandler);

		assert.throws( function () {
			this.oFlexController.createChange({}, new sap.ui.core.Control());
		});
	});

	QUnit.test("creates a change for controls with a stable id which has not the app components id as a prefix", function (assert) {

		this.stub(Utils, "getAppComponentForControl").returns(oComponent);
		var oDummyChangeHandler = {
			completeChangeContent: function () {}
		};
		this.stub(this.oFlexController, "_getChangeHandler").returns(oDummyChangeHandler);
		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "myComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});

		var oChange = this.oFlexController.createChange({}, new sap.ui.core.Control());

		assert.deepEqual(oChange.getDefinition().selector.idIsLocal, false, "the selector flags the id as NOT local.");
	});

	QUnit.test("creates a change for a map of a control with id, control type and appComponent", function (assert) {

		var oAppComponent = new sap.ui.core.UIComponent();
		var mControl = {id : this.oControl.getId(), appComponent : oAppComponent, controlType : "sap.ui.core.Control"};

		var oDummyChangeHandler = {
			completeChangeContent: function () {}
		};
		this.stub(this.oFlexController, "_getChangeHandler").returns(oDummyChangeHandler);
		this.stub(Utils,"getAppDescriptor").returns({
			"sap.app":{
				id: "myComponent",
				applicationVersion: {
					version: "1.0.0"
				}
			}
		});

		var oChange = this.oFlexController.createChange({}, mControl);

		assert.deepEqual(oChange.getDefinition().selector.idIsLocal, false, "the selector flags the id as NOT local.");
	});

	QUnit.test("throws an error if a map of a control has no appComponent or no id or no controlType", function (assert) {

		var oAppComponent = new sap.ui.core.UIComponent();
		var mControl1 = {id : this.oControl.getId(), appComponent : undefined, controlType : "sap.ui.core.Control"};
		var mControl2 = {id : undefined, appComponent : oAppComponent, controlType : "sap.ui.core.Control"};
		var mControl3 = {id : this.oControl.getId(), appComponent : oAppComponent, controlType : undefined};

		var oDummyChangeHandler = {
			completeChangeContent: function () {}
		};
		this.stub(this.oFlexController, "_getChangeHandler").returns(oDummyChangeHandler);

		assert.throws( function () {
			this.oFlexController.createChange({}, mControl1);
		});

		assert.throws( function () {
			this.oFlexController.createChange({}, mControl2);
		});

		assert.throws( function () {
			this.oFlexController.createChange({}, mControl3);
		});
	});

	QUnit.test("when processViewByModifier is called with changes", function (assert) {
		var oGetChangesForViewStub = sandbox.stub(this.oFlexController._oChangePersistence, "getChangesForView").returns(Promise.resolve());
		var oResolveGetChangesForViewSpy = sandbox.spy(this.oFlexController, "_resolveGetChangesForView");
		var oHandlePromiseChainError = sandbox.spy(this.oFlexController, "_handlePromiseChainError");
		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		return this.oFlexController.processViewByModifier(mPropertyBagStub)

		.then(function() {
			assert.ok(oGetChangesForViewStub.calledOnce, "then getChangesForView is called once");
			assert.ok(oResolveGetChangesForViewSpy.calledOnce, "then _resolveGetChangesForView is called");
			assert.notOk(oHandlePromiseChainError.calledOnce, "then error handling is skipped");
		});
	});

	QUnit.test("when processViewByModifier is called without changes", function (assert) {
		var oGetChangesForViewStub = sandbox.stub(this.oFlexController._oChangePersistence, "getChangesForView").returns(Promise.reject());
		var oResolveGetChangesForViewSpy = sandbox.spy(this.oFlexController, "_resolveGetChangesForView");
		var oHandlePromiseChainError = sandbox.spy(this.oFlexController, "_handlePromiseChainError");
		var mPropertyBagStub = {
			modifier: JsControlTreeModifier
		};

		return this.oFlexController.processViewByModifier(mPropertyBagStub)

		.then(function() {
			assert.ok(oGetChangesForViewStub.calledOnce, "then getChangesForView is called once");
			assert.notOk(oResolveGetChangesForViewSpy.calledOnce, "then _resolveGetChangesForView is skipped");
			assert.ok(oHandlePromiseChainError.calledOnce, "then error handling is called");
		});
	});

	QUnit.module("_applyChangesOnControl", {
		beforeEach: function () {
			this.oControl = new sap.ui.core.Control("someId");
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");
			this.oCheckTargetAndApplyChangeStub = sandbox.stub(this.oFlexController, "checkTargetAndApplyChange").returns(new Utils.FakePromise());
		},
		afterEach: function () {
			this.oControl.destroy();
			sandbox.restore();
		}
	});

	QUnit.test("_applyChangesOnControl does not call anything of there is no change for the control", function (assert) {
		var oSomeOtherChange = {};

		var mChanges = {
			"someOtherId": [oSomeOtherChange]
		};
		var fnGetChangesMap = function () {
			return {
				"mChanges": mChanges,
				"mDependencies": {},
				"mDependentChangesOnMe": {}
			};
		};
		var oAppComponent = {};

		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, this.oControl);
		assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 0, "no change was processed");
	});

	QUnit.test("_applyChangesOnControl processes only those changes that belong to the control", function (assert) {
		var oChange0 = {
			getKey: function () {
				return "";
			}
		};
		var oChange1 = {
			getKey: function () {
				return "";
			}
		};
		var oChange2 = {
			getKey: function () {
				return "";
			}
		};
		var oChange3 = {
			getKey: function () {
				return "";
			}
		};
		var oSomeOtherChange = {
			getKey: function () {
				return "";
			}
		};
		var mChanges = {
			"someId": [oChange0, oChange1, oChange2, oChange3],
			"someOtherId": [oSomeOtherChange]
		};
		var fnGetChangesMap = function () {
			return {
				"mChanges": mChanges,
				"mDependencies": {},
				"mDependentChangesOnMe": {}
			};
		};
		var oAppComponent = {};

		return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, this.oControl)

		.then(function() {
			assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 4, "all four changes for the control were processed");
			assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(0).args[0], oChange0, "the first change was processed first");
			assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(1).args[0], oChange1, "the second change was processed second");
			assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(2).args[0], oChange2, "the third change was processed third");
			assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(3).args[0], oChange3, "the fourth change was processed fourth");
		}.bind(this));

	});

	QUnit.test("_applyChangesOnControl dependency test 1", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("form1-1");
		var oControlGroup1 = new sap.ui.core.Control("group1-1");

		var oChange0 = {
			getKey: function () {
				return "fileNameChange0" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["group1-1"];
			}
		};
		var oChange1 = {
			getKey: function () {
				return "fileNameChange1" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group3", "group2"];
			}
		};
		var oChange2 = {
			getKey: function () {
				return "fileNameChange2" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group2", "group1-1"];
			}
		};

		var mChanges = {
			"form1-1": [oChange2, oChange1],
			"group1-1": [oChange0]
		};

		var mDependencies = {
			"fileNameChange2USERnamespace": {
				"changeObject": oChange2,
				"dependencies": ["fileNameChange0USERnamespace", "fileNameChange1USERnamespace"]
			}
		};

		var mDependentChangesOnMe = {
			"fileNameChange0USERnamespace": ["fileNameChange2USERnamespace"],
			"fileNameChange1USERnamespace": ["fileNameChange2USERnamespace"]
		};

		var fnGetChangesMap = function () {
			return {
				"mChanges": mChanges,
				"mDependencies": mDependencies,
				"mDependentChangesOnMe": mDependentChangesOnMe
			};
		};
		var oAppComponent = {};

		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlGroup1);
		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);

		assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 3, "all three changes for the control were processed");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(0).args[0], oChange0, "the first change was processed first");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(1).args[0], oChange1, "the second change was processed second");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(2).args[0], oChange2, "the third change was processed third");
	});

	QUnit.test("_applyChangesOnControl dependency test 2", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("form2-1");
		var oControlGroup1 = new sap.ui.core.Control("group2-1");

		var oChange1 = {
			getKey: function () {
				return "fileNameChange1" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group3", "group2"];
			}
		};
		var oChange2 = {
			getKey: function () {
				return "fileNameChange2" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group2", "group2-1"];
			}
		};
		var oChange3 = {
			getKey: function () {
				return "fileNameChange3" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["group2-1"];
			}
		};

		var mChanges = {
			"form2-1": [oChange2, oChange1],
			"group2-1": [oChange3]
		};

		var mDependencies = {
			"fileNameChange2USERnamespace": {
				"changeObject": oChange2,
				"dependencies": ["fileNameChange1USERnamespace"]
			}
		};

		var mDependentChangesOnMe = {
			"fileNameChange1USERnamespace": ["fileNameChange2USERnamespace"]
		};

		var fnGetChangesMap = function () {
			return {
				"mChanges": mChanges,
				"mDependencies": mDependencies,
				"mDependentChangesOnMe": mDependentChangesOnMe
			};
		};
		var oAppComponent = {};

		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlGroup1);
		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);

		assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 3, "all three changes for the control were processed");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(0).args[0], oChange3, "the third change was processed first");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(1).args[0], oChange1, "the first change was processed second");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(2).args[0], oChange2, "the second change was processed third");
	});

	var fnDependencyTest3Setup = function() {
		var oChange1 = {
			getKey: function () {
				return "fileNameChange1" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["ReversalReasonName", "Reversal", "Dates"];
			}
		};
		var oChange2 = {
			getKey: function () {
				return "fileNameChange2" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["ReversalReasonName", "Dates", "GeneralLedgerDocument"];
			}
		};
		var oChange3 = {
			getKey: function () {
				return "fileNameChange3" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["ReversalReasonName"];
			}
		};
		var oChange4 = {
			getKey: function () {
				return "fileNameChange4" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["CompanyCode","ReversalReasonName"];
			}
		};
		var oChange5 = {
			getKey: function () {
				return "fileNameChange5" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["CompanyCode"];
			}
		};

		var mChanges = {
			"mainform": [oChange1, oChange2, oChange4],
			"ReversalReasonName": [oChange3],
			"CompanyCode": [oChange5]
		};

		var mDependencies = {
			"fileNameChange2USERnamespace": {
				"changeObject": oChange2,
				"dependencies": ["fileNameChange1USERnamespace"]
			},
			"fileNameChange4USERnamespace": {
				"changeObject": oChange4,
				"dependencies": ["fileNameChange2USERnamespace"] //TODO: also dependency on first change?
			},
			"fileNameChange5USERnamespace": {
				"changeObject": oChange5,
				"dependencies": ["fileNameChange4USERnamespace"]
			}
		};

		var mDependentChangesOnMe = {
			"fileNameChange1USERnamespace": ["fileNameChange2USERnamespace"],
			"fileNameChange2USERnamespace": ["fileNameChange4USERnamespace"],
			"fileNameChange4USERnamespace": ["fileNameChange5USERnamespace"]
		};

		return {
			"mChanges": mChanges,
			"mDependencies": mDependencies,
			"mDependentChangesOnMe": mDependentChangesOnMe
		};
	};

	QUnit.test("_applyChangesOnControl dependency test 3", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("mainform");
		var oControlField1 = new sap.ui.core.Control("ReversalReasonName");
		var oControlField2 = new sap.ui.core.Control("CompanyCode");

		var oDependencySetup = fnDependencyTest3Setup();
		var fnGetChangesMap = function () {
			return oDependencySetup;
		};

		var oAppComponent = {};

		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField2);
		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField1);
		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);

		assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 5, "all five changes for the control were processed");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(0).args[0], oDependencySetup.mChanges.ReversalReasonName[0], "the third change was processed first");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(1).args[0], oDependencySetup.mChanges.mainform[0], "the first change was processed second");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(2).args[0], oDependencySetup.mChanges.mainform[1], "the second change was processed third");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(3).args[0], oDependencySetup.mChanges.mainform[2], "the fourth change was processed fourth");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(4).args[0], oDependencySetup.mChanges.CompanyCode[0], "the fifth change was processed fifth");

		oControlForm1.destroy();
		oControlField1.destroy();
		oControlField2.destroy();
	});

	QUnit.test("_applyChangesOnControl dependency test 3 - mixed changehandler (sync, async, sync, async, sync)", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("mainform");
		var oControlField1 = new sap.ui.core.Control("ReversalReasonName");
		var oControlField2 = new sap.ui.core.Control("CompanyCode");

		var oDependencySetup = fnDependencyTest3Setup();
		var fnGetChangesMap = function () {
			return oDependencySetup;
		};

		var oAppComponent = {};

		this.oCheckTargetAndApplyChangeStub.restore();
		this.oCheckTargetAndApplyChangeStub = sandbox.stub(this.oFlexController, "checkTargetAndApplyChange")
		.onCall(0).returns(new Utils.FakePromise())
		.onCall(1).returns(Promise.resolve())
		.onCall(2).returns(new Utils.FakePromise())
		.onCall(3).returns(Promise.resolve())
		.onCall(4).returns(new Utils.FakePromise());

		return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField2)
		.then(function() {
			return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField1);
		}.bind(this))
		.then(function() {
			return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);
		}.bind(this))
		.then(function() {
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.callCount, 5, "all five changes for the control were processed");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(0).args[0], oDependencySetup.mChanges.ReversalReasonName[0], "the third change was processed first");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(1).args[0], oDependencySetup.mChanges.mainform[0], "the first change was processed second");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(2).args[0], oDependencySetup.mChanges.mainform[1], "the second change was processed third");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(3).args[0], oDependencySetup.mChanges.mainform[2], "the fourth change was processed fourth");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(4).args[0], oDependencySetup.mChanges.CompanyCode[0], "the fifth change was processed fifth");

			oControlForm1.destroy();
			oControlField1.destroy();
			oControlField2.destroy();
		}.bind(this));
	});

	QUnit.test("_applyChangesOnControl dependency test 3 - mixed changehandler (async, sync, async, sync, async)", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("mainform");
		var oControlField1 = new sap.ui.core.Control("ReversalReasonName");
		var oControlField2 = new sap.ui.core.Control("CompanyCode");

		var oDependencySetup = fnDependencyTest3Setup();
		var fnGetChangesMap = function () {
			return oDependencySetup;
		};

		var oAppComponent = {};

		this.oCheckTargetAndApplyChangeStub.restore();
		this.oCheckTargetAndApplyChangeStub = sandbox.stub(this.oFlexController, "checkTargetAndApplyChange")
		.onCall(0).returns(Promise.resolve())
		.onCall(1).returns(new Utils.FakePromise())
		.onCall(2).returns(Promise.resolve())
		.onCall(3).returns(new Utils.FakePromise())
		.onCall(4).returns(Promise.resolve());

		return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField2)
		.then(function() {
			return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField1);
		}.bind(this))
		.then(function() {
			return this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);
		}.bind(this))
		.then(function() {
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.callCount, 5, "all five changes for the control were processed");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(0).args[0], oDependencySetup.mChanges.ReversalReasonName[0], "the third change was processed first");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(1).args[0], oDependencySetup.mChanges.mainform[0], "the first change was processed second");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(2).args[0], oDependencySetup.mChanges.mainform[1], "the second change was processed third");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(3).args[0], oDependencySetup.mChanges.mainform[2], "the fourth change was processed fourth");
			assert.equal(this.oCheckTargetAndApplyChangeStub.stub.getCall(4).args[0], oDependencySetup.mChanges.CompanyCode[0], "the fifth change was processed fifth");

			oControlForm1.destroy();
			oControlField1.destroy();
			oControlField2.destroy();
		}.bind(this));
	});

	QUnit.test("_applyChangesOnControl dependency test 4", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("form4");

		var oChange1 = {
			getKey: function () {
				return "fileNameChange1" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group1", "group2"];
			}
		};
		var oChange2 = {
			getKey: function () {
				return "fileNameChange2" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group2", "group3"];
			}
		};

		var mChanges = {
			"form4": [oChange1, oChange2]
		};

		var mDependencies = {
			"fileNameChange2USERnamespace": {
				"changeObject": oChange2,
				"dependencies": ["fileNameChange1USERnamespace"]
			}
		};

		var mDependentChangesOnMe = {
			"fileNameChange1USERnamespace": ["fileNameChange2USERnamespace"]
		};

		var fnGetChangesMap = function () {
			return {
				"mChanges": mChanges,
				"mDependencies": mDependencies,
				"mDependentChangesOnMe": mDependentChangesOnMe
			};
		};
		var oAppComponent = {};

		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);

		assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 2, "all two changes for the control were processed");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(0).args[0], oChange1, "the first change was processed first");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(1).args[0], oChange2, "the second change was processed second");
	});

	QUnit.test("_applyChangesOnControl dependency test 5", function (assert) {
		var oControlForm1 = new sap.ui.core.Control("form5");
		var oControlField1 = new sap.ui.core.Control("field5");
		var iStubCalls = 0;

		var oChange1 = {
			getKey: function () {
				return "fileNameChange1" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group1", "group2"];
			}
		};
		var oChange2 = {
			getKey: function () {
				return "fileNameChange2" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group2", "group3"];
			}
		};
		var oChange3 = {
			getKey: function () {
				return "fileNameChange3" + "USER" + "namespace";
			},
			getDependentIdList: function () {
				return ["field3-2", "group3", "group4"];
			}
		};

		var mChanges = {
			"form5": [oChange1, oChange2, oChange3]
		};

		var mDependencies = {
			"fileNameChange2USERnamespace": {
				"changeObject": oChange2,
				"dependencies": ["fileNameChange1USERnamespace"]
			},
			"fileNameChange3USERnamespace": {
				"changeObject": oChange3,
				"dependencies": ["fileNameChange1USERnamespace"]
			}
		};

		var mDependentChangesOnMe = {
			"fileNameChange1USERnamespace": ["fileNameChange2USERnamespace", "fileNameChange3USERnamespace"]
		};

		var fnGetChangesMap = function () {
			return {
				"mChanges": mChanges,
				"mDependencies": mDependencies,
				"mDependentChangesOnMe": mDependentChangesOnMe
			};
		};

		var oAppComponent = {};

		this.oCheckTargetAndApplyChangeStub.restore();
		this.oCheckTargetAndApplyChangeStub = sandbox.stub(this.oFlexController, "checkTargetAndApplyChange", function(oChange, oControl, mPropertyBag) {
			if (oControl === oControlForm1 && iStubCalls === 1) {
				this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlField1);
			}
			iStubCalls++;
			return new Utils.FakePromise();
		}.bind(this));

		this.oFlexController._applyChangesOnControl(fnGetChangesMap, oAppComponent, oControlForm1);

		assert.equal(this.oCheckTargetAndApplyChangeStub.callCount, 3, "all three changes for the control were processed");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(0).args[0], oChange1, "the first change was processed first");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(1).args[0], oChange2, "the second change was processed second");
		assert.equal(this.oCheckTargetAndApplyChangeStub.getCall(2).args[0], oChange3, "the third change was processed third");
	});

	QUnit.module("[JS] checkTargetAndApplyChange / removeFromAppliedChanges with one change for a label", {
		beforeEach: function (assert) {
			this.sLabelId = labelChangeContent.selector.id;
			this.oControl = new sap.m.Label(this.sLabelId);
			this.oChange = new Change(labelChangeContent);
			this.mChanges = {
				"mChanges": {},
				"mDependencies": {},
				"mDependentChangesOnMe": {}
			};
			this.mChanges.mChanges[this.sLabelId] = [this.oChange];
			this.fnGetChangesMap = function () {
				return this.mChanges;
			}.bind(this);
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");

			this.oChangeHandlerApplyChangeStub = sandbox.stub();
			this.oChangeHandlerRevertChangeStub = sandbox.stub();
			sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
				applyChange: this.oChangeHandlerApplyChangeStub,
				revertChange: this.oChangeHandlerRevertChangeStub
			});
		},
		afterEach: function (assert) {
			this.oControl.destroy();
			sandbox.restore();
		}
	});

	QUnit.test("adds custom data on the first sync change applied on a control", function (assert) {
		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		assert.equal(this.oControl.getCustomData()[0].getValue(), this.oChange.getId(), "the change id is the value");
	});

	QUnit.test("adds custom data on the first async change applied on a control", function (assert) {
		sandbox.restore();
		this.oChangeHandlerApplyChangeStub = sandbox.stub().returns(Promise.resolve());
		sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
			applyChange: this.oChangeHandlerApplyChangeStub
		});

		return this.oFlexController.checkTargetAndApplyChange(this.oChange, this.oControl, {
			modifier: JsControlTreeModifier,
			appComponent: {}
		})

		.then(function () {
			assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
			assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
			assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
			assert.equal(this.oControl.getCustomData()[0].getValue(), this.oChange.getId(), "the change id is the value");
		}.bind(this));
	});

	QUnit.test("deletes the changeId from custom data after reverting the change", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);
		return this.oFlexController.revertChangesOnControl([this.oChange], this.oControl)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 1, "the changeHandler was called");
			assert.equal(this.oControl.getCustomData().length, 1, "the CustomData is still there");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "the changeId got deleted from the customData");
		}.bind(this));
	});

	QUnit.test("deletes the changeId from custom data without reverting the change", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);
		return this.oFlexController.removeFromAppliedChangesOnControl(this.oChange, {}, this.oControl)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 0, "the changeHandler was NOT called");
			assert.equal(this.oControl.getCustomData().length, 1, "the CustomData is still there");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "the changeId got deleted from the customData");
		}.bind(this));
	});

	QUnit.test("does not add custom data if an exception was raised during sync applyChanges", function (assert) {
		this.oChangeHandlerApplyChangeStub.throws();
		var mergeErrorStub = sandbox.stub(this.oFlexController, "_setMergeError");

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);
		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "apply change functionality was called");
		assert.equal(this.oControl.getCustomData().length, 0, "no custom data was set");
		assert.ok(mergeErrorStub.calledOnce, "set merge error was called");
	});

	QUnit.test("does not add custom data if an exception was raised during async applyChanges", function (assert) {
		sandbox.restore();
		var mergeErrorStub = sandbox.stub(this.oFlexController, "_setMergeError");
		this.oChangeHandlerApplyChangeStub = sandbox.stub().returns(Promise.reject(new Error()));
		sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
			applyChange: this.oChangeHandlerApplyChangeStub
		});

		return this.oFlexController.checkTargetAndApplyChange(this.oChange, this.oControl, {
			modifier: JsControlTreeModifier,
			appComponent: {}
		})

		.then(function() {
			assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "apply change functionality was called");
			assert.equal(this.oControl.getCustomData().length, 0, "no custom data was set");
			assert.ok(mergeErrorStub.calledOnce, "set merge error was called");
		}.bind(this));
	});

	QUnit.test("concatenate custom data on the later changes applied on a control", function (assert) {
		var sAlreadyAppliedChangeId = "id_123_anAlreadyAppliedChange";
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: sAlreadyAppliedChangeId
		});
		this.oControl.addCustomData(oFlexCustomData);

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		var sExpectedFlexCustomDataValue = sAlreadyAppliedChangeId + "," + this.oChange.getId();
		assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedFlexCustomDataValue, "the change id is the value");
	});

	QUnit.test("delete only reverted changeId from custom data", function (assert) {
		var sAlreadyAppliedChangeId = "id_123_anAlreadyAppliedChange";
		var sAlreadyAppliedChangeId2 = "id_456_anAlreadyAppliedChange";
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: sAlreadyAppliedChangeId + "," + sAlreadyAppliedChangeId2 + "," + this.oChange.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);

		return this.oFlexController.revertChangesOnControl([this.oChange], this.oControl)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 1, "the changeHandler was called");
			assert.equal(this.oControl.getCustomData()[0].getValue(),
				"id_123_anAlreadyAppliedChange,id_456_anAlreadyAppliedChange",
				"only the changeId was deleted from the custom data");
		}.bind(this));
	});

	QUnit.test("does not call the change handler if the change was already applied", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.equal(this.oChangeHandlerApplyChangeStub.callCount, 0, "the change was NOT applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData is still set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		assert.equal(this.oControl.getCustomData()[0].getValue(), this.oChange.getId(), "the change id is the value");
	});

	QUnit.test("does not call the change handler if the change wasn't applied", function(assert) {
		return this.oFlexController.revertChangesOnControl([this.oChange], this.oControl)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 0, "the changeHandler was not called");
			assert.equal(this.oControl.getCustomData().length, 0, "the customData was not created yet");
		}.bind(this));
	});

	QUnit.module("applyVariantChanges with two changes for a label", {
		beforeEach: function (assert) {
			this.sLabelId = labelChangeContent.selector.id;
			this.oControl = new sap.m.Label(this.sLabelId);
			this.oChange = new Change(labelChangeContent);
			this.oChange2 = new Change(labelChangeContent2);
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");

			this.oAddChangeAndUpdateDependenciesSpy = sandbox.spy(this.oFlexController._oChangePersistence, "_addChangeAndUpdateDependencies");
			this.oApplyChangesOnControlStub = sandbox.stub(this.oFlexController, "_applyChangesOnControl").returns(new Utils.FakePromise());

			var oManifestObj = {
				"sap.app": {
					id: "MyComponent",
					"applicationVersion": {
						"version" : "1.2.3"
					}
				}
			};
			var oManifest = new sap.ui.core.Manifest(oManifestObj);
			this.oComponent = {
				name: "testScenarioComponent",
				appVersion: "1.2.3",
				getId : function() {return "RTADemoAppMD";},
				getManifestObject : function() {return oManifest;}
			};
		},
		afterEach: function (assert) {
			this.oControl.destroy();
			sandbox.restore();
		}
	});

	QUnit.test("when applyVariantChanges is called with 2 unapplied changes. One of them has a wrong selector", function (assert) {
		this.oChangeWithWrongSelector = new Change(labelChangeContent4);
		this.oFlexController.applyVariantChanges([this.oChange, this.oChangeWithWrongSelector], this.oComponent);

		assert.ok(this.oApplyChangesOnControlStub.firstCall.calledAfter(this.oAddChangeAndUpdateDependenciesSpy.secondCall), "then _applyChangesOnControl after all dependencies have been udpated");
		assert.ok(this.oFlexController._oChangePersistence.getChangesMapForComponent().mChanges["abc123"].length, 1, "then 1 change added to map");
		assert.equal(this.oApplyChangesOnControlStub.callCount, 1, "one change was applied");
		assert.equal(this.oAddChangeAndUpdateDependenciesSpy.callCount, 2, "two changes were added to the map and dependencies were updated");
	});

	QUnit.test("when applyVariantChanges is called with 2 unapplied changes", function (assert) {
		this.oFlexController.applyVariantChanges([this.oChange, this.oChange2], this.oComponent);

		assert.ok(this.oApplyChangesOnControlStub.firstCall.calledAfter(this.oAddChangeAndUpdateDependenciesSpy.secondCall), "then _applyChangesOnControl after all dependencies have been udpated");
		assert.ok(this.oFlexController._oChangePersistence.getChangesMapForComponent().mChanges["abc123"].length, 2, "then 2 changes added to map");
		assert.equal(this.oApplyChangesOnControlStub.callCount, 2, "both changes were applied");
		assert.equal(this.oAddChangeAndUpdateDependenciesSpy.callCount, 2, "both changes were added to the map and dependencies were updated");
	});

	QUnit.module("[JS] checkTargetAndApplyChange / removeFromAppliedChanges with two changes for a label", {
		beforeEach: function (assert) {
			this.sLabelId = labelChangeContent.selector.id;
			this.oControl = new sap.m.Label(this.sLabelId);
			this.oChange = new Change(labelChangeContent);
			this.oChange2 = new Change(labelChangeContent2);
			this.mChanges = {
				"mChanges": {},
				"mDependencies": {},
				"mDependentChangesOnMe": {}
			};
			this.mChanges.mChanges[this.sLabelId] = [this.oChange, this.oChange2];
			this.fnGetChangesMap = function () {
				return this.mChanges;
			}.bind(this);
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");

			this.oChangeHandlerApplyChangeStub = sandbox.stub();
			this.oChangeHandlerRevertChangeStub = sandbox.stub();
			this.oAddChangeAndUpdateDependenciesSpy = sandbox.spy(this.oFlexController._oChangePersistence, "_addChangeAndUpdateDependencies");
			this.oApplyChangesOnControlSpy = sandbox.spy(this.oFlexController, "_applyChangesOnControl");
			this.oDeleteChangeInMapSpy = sandbox.spy(this.oFlexController._oChangePersistence, "_deleteChangeInMap");

			sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
				applyChange: this.oChangeHandlerApplyChangeStub,
				revertChange: this.oChangeHandlerRevertChangeStub
			});

			var oManifestObj = {
				"sap.app": {
					id: "MyComponent",
					"applicationVersion": {
						"version" : "1.2.3"
					}
				}
			};
			var oManifest = new sap.ui.core.Manifest(oManifestObj);
			this.oComponent = {
				name: "testScenarioComponent",
				appVersion: "1.2.3",
				getId : function() {return "RTADemoAppMD";},
				getManifestObject : function() {return oManifest;}
			};
		},
		afterEach: function (assert) {
			this.oControl.destroy();
			sandbox.restore();
		}
	});

	QUnit.test("calls the change handler twice for two unapplied changes and concatenate the custom data correct", function (assert) {
		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.ok(this.oChangeHandlerApplyChangeStub.calledTwice, "both changes were applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		var sExpectedValue = this.oChange.getId() + "," + this.oChange2.getId();
		assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedValue, "the concatenated change ids are the value");
	});

	QUnit.test("calls the change handler twice for two unapplied async changes and concatenate the custom data correct", function (assert) {
		sandbox.restore();
		this.oChangeHandlerApplyChangeStub = sandbox.stub().returns(Promise.resolve());
		sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
			applyChange: this.oChangeHandlerApplyChangeStub
		});
		return this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl)

		.then(function () {
			assert.strictEqual(this.oChangeHandlerApplyChangeStub.callCount, 2, "all changes were applied");
			assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
			assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
			var sExpectedValue = this.oChange.getId() + "," + this.oChange2.getId();
			assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedValue, "the concatenated change ids are the value");
		}.bind(this));
	});

	QUnit.test("calls the change handler twice and delete the ids from the custom data", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId() + "," + this.oChange2.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);
		return this.oFlexController.revertChangesOnControl([this.oChange, this.oChange2], this.oControl)

		.then(function() {
			assert.ok(this.oDeleteChangeInMapSpy.calledTwice, "both changes were deleted from the map");
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 2, "both changes were reverted");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "then both changeIds got deleted");
		}.bind(this));
	});

	QUnit.test("calls the change handler twice and delete the ids from the custom data separately", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId() + "," + this.oChange2.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);
		return this.oFlexController.revertChangesOnControl([this.oChange], this.oControl)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 1, "first change was reverted");
			assert.equal(this.oControl.getCustomData()[0].getValue(), this.oChange2.getId(), "then only the first changeId got deleted");
		}.bind(this))

		.then(function() {
			return this.oFlexController.revertChangesOnControl([this.oChange2], this.oControl);
		}.bind(this))

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 2, "both changes were reverted");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "then both changeIds got deleted");
		}.bind(this));
	});

	QUnit.test("concatenate custom data on the later changes (first already applied) applied on a control", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);
		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
		assert.equal(this.oChangeHandlerApplyChangeStub.getCall(0).args[0], this.oChange2, "the second change was applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		var sExpectedValue = this.oChange.getId() + "," + this.oChange2.getId();
		assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedValue, "the concatenated change ids are the value");
	});

	QUnit.test("concatenate custom data on the later changes (second already applied) applied on a control", function (assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange2.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
		assert.equal(this.oChangeHandlerApplyChangeStub.getCall(0).args[0], this.oChange, "the first change was applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		var sExpectedValue = this.oChange2.getId() + "," + this.oChange.getId();
		assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedValue, "the concatenated change ids are the value");
	});

	QUnit.test("change handler not called for two applied changes", function (assert) {
		var sFlexCustomDataValue = this.oChange.getId() + "," + this.oChange2.getId();
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: sFlexCustomDataValue
		});
		this.oControl.addCustomData(oFlexCustomData);

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		assert.equal(this.oChangeHandlerApplyChangeStub.callCount, 0, "no changes were applied");
		assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
		assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		assert.equal(this.oControl.getCustomData()[0].getValue(), sFlexCustomDataValue, "the concatenated change ids are the value");
	});

	QUnit.test("does not call the change handler if the change wasn't applied, with already existing customData", function(assert) {
		var oFlexCustomData = new sap.ui.core.CustomData({
			key: FlexController.appliedChangesCustomDataKey,
			value: this.oChange.getId()
		});
		this.oControl.addCustomData(oFlexCustomData);

		return this.oFlexController.revertChangesOnControl([this.oChange2], this.oControl)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 0, "the changeHandler was not called");
			assert.equal(this.oControl.getCustomData()[0].getValue(), this.oChange.getId(), "then the custom data is still the same");
		}.bind(this));
	});

	QUnit.module("[JS] checkTargetAndApplyChange / removeFromAppliedChanges with three changes for a label", {
		beforeEach: function (assert) {
			this.sLabelId = labelChangeContent.selector.id;
			this.oControl = new sap.m.Label(this.sLabelId);
			this.oChange = new Change(labelChangeContent);
			this.oChange2 = new Change(labelChangeContent2);
			this.oChange3 = new Change(labelChangeContent3);
			this.mChanges = {
				"mChanges": {},
				"mDependencies": {},
				"mDependentChangesOnMe": {}
			};
			this.mChanges.mChanges[this.sLabelId] = [this.oChange, this.oChange2, this.oChange3];
			this.fnGetChangesMap = function () {
				return this.mChanges;
			}.bind(this);
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");

			this.oAddChangeAndUpdateDependenciesSpy = sandbox.spy(this.oFlexController._oChangePersistence, "_addChangeAndUpdateDependencies");
			this.oApplyChangesOnControlSpy = sandbox.spy(this.oFlexController, "_applyChangesOnControl");
			this.oDeleteChangeInMapSpy = sandbox.spy(this.oFlexController._oChangePersistence, "_deleteChangeInMap");

			var oManifestObj = {
				"sap.app": {
					id: "MyComponent",
					"applicationVersion": {
						"version" : "1.2.3"
					}
				}
			};
			var oManifest = new sap.ui.core.Manifest(oManifestObj);
			this.oComponent = {
				name: "testScenarioComponent",
				appVersion: "1.2.3",
				getId : function() {return "RTADemoAppMD";},
				getManifestObject : function() {return oManifest;}
			};
		},
		afterEach: function (assert) {
			this.oControl.destroy();
			sandbox.restore();
		}
	});

	QUnit.test("calls the change handler thrice for three unapplied changes (async, sync, async) and then reverts them", function (assert) {
		var oAsyncChangeHandlerApplyChangeStub = sandbox.stub().returns(Promise.resolve());
		var oSyncChangeHandlerApplyChangeStub = sandbox.stub();
		var oAsyncChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		var oSyncChangeHandlerRevertChangeStub = sandbox.stub();
		sandbox.stub(this.oFlexController, "_getChangeHandler")
		.onCall(0).returns({
			applyChange: oAsyncChangeHandlerApplyChangeStub
		})
		.onCall(1).returns({
			applyChange: oSyncChangeHandlerApplyChangeStub
		})
		.onCall(2).returns({
			applyChange: oAsyncChangeHandlerApplyChangeStub
		})
		.onCall(3).returns({
			revertChange: oAsyncChangeHandlerRevertChangeStub
		})
		.onCall(4).returns({
			revertChange: oSyncChangeHandlerRevertChangeStub
		})
		.onCall(5).returns({
			revertChange: oAsyncChangeHandlerRevertChangeStub
		});
		return this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl)

		.then(function () {
			assert.strictEqual(oAsyncChangeHandlerApplyChangeStub.callCount, 2, "all async changes were applied");
			assert.strictEqual(oSyncChangeHandlerApplyChangeStub.callCount, 1, "all sync changes were applied");
			assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
			assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
			var sExpectedValue = this.oChange.getId() + "," + this.oChange2.getId() + "," + this.oChange3.getId();
			assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedValue, "the concatenated change ids are the value");
		}.bind(this))

		.then(function() {
			return this.oFlexController.revertChangesOnControl([this.oChange, this.oChange2, this.oChange3], this.oControl);
		}.bind(this))

		.then(function() {
			assert.equal(oAsyncChangeHandlerRevertChangeStub.callCount, 2, "the async changeHandler was called");
			assert.equal(oSyncChangeHandlerRevertChangeStub.callCount, 1, "the sync changeHandler was called");
			assert.equal(this.oControl.getCustomData().length, 1, "the CustomData is still there");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "the changeId got deleted from the customData");
		}.bind(this));
	});

	QUnit.test("calls the change handler thrice for three unapplied changes (sync, async, async) and then reverts them", function (assert) {
		var oAsyncChangeHandlerApplyChangeStub = sandbox.stub().returns(Promise.resolve());
		var oSyncChangeHandlerApplyChangeStub = sandbox.stub();
		var oAsyncChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		var oSyncChangeHandlerRevertChangeStub = sandbox.stub();
		sandbox.stub(this.oFlexController, "_getChangeHandler")
		.onCall(0).returns({
			applyChange: oSyncChangeHandlerApplyChangeStub
		})
		.onCall(1).returns({
			applyChange: oAsyncChangeHandlerApplyChangeStub
		})
		.onCall(2).returns({
			applyChange: oAsyncChangeHandlerApplyChangeStub
		})
		.onCall(3).returns({
			revertChange: oSyncChangeHandlerRevertChangeStub
		})
		.onCall(4).returns({
			revertChange: oAsyncChangeHandlerRevertChangeStub
		})
		.onCall(5).returns({
			revertChange: oAsyncChangeHandlerRevertChangeStub
		});
		return this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl)

		.then(function () {
			assert.strictEqual(oAsyncChangeHandlerApplyChangeStub.callCount, 2, "all async changes were applied");
			assert.strictEqual(oSyncChangeHandlerApplyChangeStub.callCount, 1, "all sync changes were applied");
			assert.ok(this.oControl.getCustomData()[0], "CustomData was set");
			assert.equal(this.oControl.getCustomData()[0].getKey(), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
			var sExpectedValue = this.oChange.getId() + "," + this.oChange2.getId() + "," + this.oChange3.getId();
			assert.equal(this.oControl.getCustomData()[0].getValue(), sExpectedValue, "the concatenated change ids are the value");
		}.bind(this))

		.then(function() {
			return this.oFlexController.revertChangesOnControl([this.oChange, this.oChange2, this.oChange3], this.oControl);
		}.bind(this))

		.then(function() {
			assert.equal(oAsyncChangeHandlerRevertChangeStub.callCount, 2, "the async changeHandler was called");
			assert.equal(oSyncChangeHandlerRevertChangeStub.callCount, 1, "the sync changeHandler was called");
			assert.equal(this.oControl.getCustomData().length, 1, "the CustomData is still there");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "the changeId got deleted from the customData");
		}.bind(this));
	});


	QUnit.test("calls apply change on control with async changehandler and reverts them", function (assert) {
		var fnDelayedPromise = new Promise(function(fnResolve) {
			setTimeout(function() {
				fnResolve();
			}, 0);
		});
		var oFirstAsyncChangeHandlerApplyChangeStub = sandbox.stub().returns(fnDelayedPromise);
		var oFirstAsyncChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		var oSecondAsyncChangeHandlerApplyChangeStub = sandbox.stub().returns(fnDelayedPromise);
		var oSecondAsyncChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		var oThirdAsyncChangeHandlerApplyChangeStub = sandbox.stub().returns(fnDelayedPromise);
		var oThirdAsyncChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		sandbox.stub(this.oFlexController, "_getChangeHandler")
		.onCall(0).returns({ applyChange: oFirstAsyncChangeHandlerApplyChangeStub })
		.onCall(1).returns({ revertChange: oFirstAsyncChangeHandlerRevertChangeStub })
		.onCall(2).returns({ applyChange: oSecondAsyncChangeHandlerApplyChangeStub })
		.onCall(3).returns({ revertChange: oSecondAsyncChangeHandlerRevertChangeStub })
		.onCall(4).returns({ applyChange: oThirdAsyncChangeHandlerApplyChangeStub })
		.onCall(5).returns({ revertChange: oThirdAsyncChangeHandlerRevertChangeStub });

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl)

		.then(function () {
			assert.strictEqual(oFirstAsyncChangeHandlerApplyChangeStub.callCount, 1, "then the first async change is applied");
			assert.strictEqual(oSecondAsyncChangeHandlerApplyChangeStub.callCount, 1, "then the second async change is applied");
			assert.strictEqual(oThirdAsyncChangeHandlerApplyChangeStub.callCount, 1, "then the third async change is applied");
		});

		assert.equal(this.oChange.QUEUED, true, "then first change is pending");
		return this.oFlexController.revertChangesOnControl([this.oChange, this.oChange2, this.oChange3], this.oControl)

		.then(function() {
			assert.notOk(this.oChange.QUEUED, "then first change is not pending anymore");
			assert.strictEqual(oFirstAsyncChangeHandlerRevertChangeStub.callCount, 1, "then the first async change is reverted");
			assert.strictEqual(oSecondAsyncChangeHandlerRevertChangeStub.callCount, 1, "then the second async change is reverted");
			assert.strictEqual(oThirdAsyncChangeHandlerRevertChangeStub.callCount, 1, "then the third async change is reverted");
			assert.equal(this.oControl.getCustomData().length, 1, "the CustomData is still there");
			assert.equal(this.oControl.getCustomData()[0].getValue(), "", "the changeId got deleted from the customData");
			assert.ok(oFirstAsyncChangeHandlerRevertChangeStub.calledAfter(oFirstAsyncChangeHandlerApplyChangeStub), "then the first revert was called after the first apply change");
			assert.ok(oSecondAsyncChangeHandlerRevertChangeStub.calledAfter(oSecondAsyncChangeHandlerApplyChangeStub), "then the second revert was called after the second apply change");
			assert.ok(oThirdAsyncChangeHandlerRevertChangeStub.calledAfter(oThirdAsyncChangeHandlerApplyChangeStub), "then the third revert was called after the third apply change");
		}.bind(this));
	});

	QUnit.test("calls revert change when previously called async apply change throws exception", function (assert) {
		var fnDelayedPromiseReject = new Promise(function(fnResolve, fnReject) {
			setTimeout(function() {
				fnReject(new Error("Test error"));
			}, 0);
		});
		var oFirstAsyncChangeHandlerApplyChangeStub = sandbox.stub().returns(fnDelayedPromiseReject);
		var oFirstAsyncChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		var oSetMergeErrorStub = sandbox.stub(this.oFlexController, "_setMergeError");
		sandbox.stub(this.oFlexController, "_getChangeHandler")
		.onCall(0).returns({ applyChange: oFirstAsyncChangeHandlerApplyChangeStub })
		.onCall(1).returns({ revertChange: oFirstAsyncChangeHandlerRevertChangeStub });

		this.oFlexController._applyChangesOnControl(this.fnGetChangesMap, {}, this.oControl);

		return this.oFlexController.revertChangesOnControl([this.oChange, this.oChange2, this.oChange3], this.oControl)

		.then(function() {
			assert.strictEqual(oFirstAsyncChangeHandlerApplyChangeStub.callCount, 1, "then the first async change is applied");
			assert.strictEqual(oFirstAsyncChangeHandlerRevertChangeStub.callCount, 0, "then the first async revert change is never called");
			assert.strictEqual(oSetMergeErrorStub.callCount, 1, "then _setMergeError function is called");
			assert.equal(this.oControl.getCustomData().length, 0, "the CustomData is not there");
		}.bind(this));
	});

	QUnit.module("[XML] checkTargetAndApplyChange with one change for a label", {
		beforeEach: function (assert) {
			this.sLabelId = labelChangeContent.selector.id;
			this.oDOMParser = new DOMParser();
			this.oChange = new Change(labelChangeContent);
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");

			this.oChangeHandlerApplyChangeStub = sandbox.stub();
			this.oChangeHandlerRevertChangeStub = sandbox.stub();
			sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
				applyChange: this.oChangeHandlerApplyChangeStub,
				revertChange: this.oChangeHandlerRevertChangeStub
			});
		},
		afterEach: function (assert) {
			sandbox.restore();
		}
	});

	QUnit.test("adds custom data on the first change applied on a control", function (assert) {
		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m">' +
			'<Label id="' + this.sLabelId  + '" />' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml").documentElement;
		this.oControl = this.oView.childNodes[0];

		this.oFlexController.checkTargetAndApplyChange(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView});

		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
		var oCustomDataAggregationNode = this.oControl.getElementsByTagName("customData")[0];
		assert.equal(oCustomDataAggregationNode.childElementCount, 1, "CustomData was set");
		var oCustomData = oCustomDataAggregationNode.childNodes[0];
		assert.equal(oCustomData.getAttribute("key"), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		assert.equal(oCustomData.getAttribute("value"), this.oChange.getId(), "the change id is the value");
	 });

	QUnit.test("reverts add custom data on the first sync change applied on a control", function (assert) {
		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns="sap.m">' +
				'<Label id="' + this.sLabelId  + '" >' +
					'<customData><core:CustomData key="' + FlexController.appliedChangesCustomDataKey + '" value="a"/></customData>' +
				'</Label>' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml").documentElement;
		this.oControl = this.oView.childNodes[0];

		return this.oFlexController._removeFromAppliedChangesAndMaybeRevert(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView}, true)

		.then(function() {
			assert.ok(this.oChangeHandlerRevertChangeStub.calledOnce, "the change was reverted");
			var oCustomData = this.oControl.getElementsByTagName("customData")[0].childNodes[0];
			assert.equal(oCustomData.getAttribute("value"), "", "the change id got deleted");
		}.bind(this));
	});

	QUnit.test("reverts add custom data on the first async change applied on a control", function (assert) {
		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m" xmlns:core="sap.ui.core">' +
				'<Label id="' + this.sLabelId  + '" >' +
					'<customData><core:CustomData key="' + FlexController.appliedChangesCustomDataKey + '" value="a"/></customData>' +
				'</Label>' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml");
		this.oControl = this.oView.childNodes[0].childNodes[0];
		sandbox.restore();
		this.oChangeHandlerRevertChangeStub = sandbox.stub().returns(Promise.resolve());
		sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
			revertChange: this.oChangeHandlerRevertChangeStub
		});
		return this.oFlexController._removeFromAppliedChangesAndMaybeRevert(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView}, true)

		.then(function() {
			assert.ok(this.oChangeHandlerRevertChangeStub.calledOnce, "the change was reverted");
			var oCustomData = this.oControl.getElementsByTagName("customData")[0].childNodes[0];
			assert.equal(oCustomData.getAttribute("value"), "", "the change id got deleted");
		}.bind(this));
	});

	QUnit.test("concatenate custom data on the later changes applied on a control", function (assert) {
		var sAlreadyAppliedChangeId = "id_123_anAlreadyAppliedChange";

		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns="sap.m">' +
			'<Label id="' + this.sLabelId + '" >' +
				'<customData><core:CustomData key="' + FlexController.appliedChangesCustomDataKey + '" value="' + sAlreadyAppliedChangeId + '"/></customData>' +
				'</Label>' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml").documentElement;
		this.oControl = this.oView.childNodes[0];

		this.oFlexController.checkTargetAndApplyChange(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView});

		assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
		var oCustomDataAggregationNode = this.oControl.getElementsByTagName("customData")[0];
		assert.equal(oCustomDataAggregationNode.childElementCount, 1, "CustomData was set");
		var oCustomData = oCustomDataAggregationNode.childNodes[0];
		assert.equal(oCustomData.getAttribute("key"), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		var sExpectedFlexCustomDataValue = sAlreadyAppliedChangeId + "," + this.oChange.getId();
		assert.equal(oCustomData.getAttribute("value"), sExpectedFlexCustomDataValue, "the change id is the value");
	});

	QUnit.test("does not call the change handler if the change was already applied", function (assert) {
		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns="sap.m">' +
			'<Label id="' + this.sLabelId + '" >' +
			'<customData><core:CustomData key="' + FlexController.appliedChangesCustomDataKey + '" value="' + this.oChange.getId() + '"/></customData>' +
			'</Label>' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml").documentElement;
		this.oControl = this.oView.childNodes[0];

		this.oFlexController.checkTargetAndApplyChange(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView});

		assert.equal(this.oChangeHandlerApplyChangeStub.callCount, 0, "the change handler was not called again");
		var oCustomDataAggregationNode = this.oControl.getElementsByTagName("customData")[0];
		assert.equal(oCustomDataAggregationNode.childElementCount, 1, "CustomData is still present");
		var oCustomData = oCustomDataAggregationNode.childNodes[0];
		assert.equal(oCustomData.getAttribute("key"), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
		assert.equal(oCustomData.getAttribute("value"), this.oChange.getId(), "the change id is the value");
	});

	QUnit.test("does not call the change handler if the change was not applied before", function(assert) {
		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns="sap.m">' +
			'<Label id="' + this.sLabelId + '" >' +
			'</Label>' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml").documentElement;
		this.oControl = this.oView.childNodes[0];

		return this.oFlexController._removeFromAppliedChangesAndMaybeRevert(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView}, true)

		.then(function() {
			assert.equal(this.oChangeHandlerRevertChangeStub.callCount, 0, "the changehandler wasn't called");
			assert.equal(this.oControl.getElementsByTagName("customData").length, 0, "no customData is available");
		}.bind(this));
	});


	QUnit.module("isPersonalized", {
		beforeEach: function () {
			this.oUserChange = new Change({
				"fileType": "change",
				"layer": "USER",
				"fileName": "a",
				"namespace": "b",
				"packageName": "c",
				"changeType": "labelChange",
				"creation": "",
				"reference": "",
				"selector": {
					"id": "abc123"
				},
				"content": {
					"something": "createNewVariant"
				}
			});

			this.oVendorChange1 = new Change({
				"fileType": "change",
				"layer": "VENDOR",
				"fileName": "a",
				"namespace": "b",
				"packageName": "c",
				"changeType": "labelChange",
				"creation": "",
				"reference": "",
				"selector": {
					"id": "abc123"
				},
				"content": {
					"something": "createNewVariant"
				}
			});

			this.oVendorChange2 = new Change({
				"fileType": "change",
				"layer": "VENDOR",
				"fileName": "a",
				"namespace": "b",
				"packageName": "c",
				"changeType": "labelChange",
				"creation": "",
				"reference": "",
				"selector": {
					"id": "abc123"
				},
				"content": {
					"something": "createNewVariant"
				}
			});
			this.oFlexController = new FlexController("someReference");
		},
		afterEach: function () {
			sandbox.restore();
		}
	});

	QUnit.test("detects personalization and ends the check on the first personalization", function (assert) {
		var oVendorChange2Spy = this.spy(this.oVendorChange2, "getLayer");
		var aChanges = [this.oVendorChange1, this.oUserChange, oVendorChange2Spy];
		sandbox.stub(this.oFlexController, "getComponentChanges").returns(Promise.resolve(aChanges));

		return this.oFlexController.isPersonalized().then(function (bIsPersonalized) {
			assert.ok(bIsPersonalized, "personalization was determined");
			assert.notOk(oVendorChange2Spy.called, "after a personalization was detected no further checks were made");
		});
	});

	QUnit.test("detects application free of personalization", function (assert) {
		var aChanges = [this.oVendorChange1, this.oVendorChange2];
		this.stub(this.oFlexController, "getComponentChanges").returns(Promise.resolve(aChanges));

		return this.oFlexController.isPersonalized().then(function (bIsPersonalized) {
			assert.notOk(bIsPersonalized, "personalization was determined");
		});
	});

	QUnit.module("[XML] checkTargetAndApplyChange with asynchronous changeHandler stub for a label", {
		beforeEach: function (assert) {
			this.sLabelId = labelChangeContent.selector.id;
			this.oDOMParser = new DOMParser();
			this.oChange = new Change(labelChangeContent);
			this.oFlexController = new FlexController("testScenarioComponent", "1.2.3");

			this.oChangeHandlerApplyChangeStub = sandbox.stub().returns(Promise.resolve(true));
			sandbox.useFakeTimers();
			sandbox.clock = 1000;

			sandbox.stub(this.oFlexController, "_getChangeHandler").returns({
				applyChange: this.oChangeHandlerApplyChangeStub
			});
		},
		afterEach: function (assert) {
			sandbox.restore();
		}
	});

	QUnit.test("adds custom data on the first change applied on a control", function (assert) {
		this.oXmlString =
			'<mvc:View id="testComponent---myView" xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m">' +
			'<Label id="' + this.sLabelId  + '" />' +
			'</mvc:View>';
		this.oView = this.oDOMParser.parseFromString(this.oXmlString, "application/xml").documentElement;
		this.oControl = this.oView.childNodes[0];

		return this.oFlexController.checkTargetAndApplyChange(this.oChange, this.oControl, {modifier: XmlTreeModifier, view: this.oView})

		.then(function() {
			assert.ok(this.oChangeHandlerApplyChangeStub.calledOnce, "the change was applied");
			var oCustomDataAggregationNode = this.oControl.getElementsByTagName("customData")[0];
			assert.equal(oCustomDataAggregationNode.childElementCount, 1, "CustomData was set");
			var oCustomData = oCustomDataAggregationNode.childNodes[0];
			assert.equal(oCustomData.getAttribute("key"), FlexController.appliedChangesCustomDataKey, "the key of the custom data is correct");
			assert.equal(oCustomData.getAttribute("value"), this.oChange.getId(), "the change id is the value");
		}.bind(this));
	 });

});

"use strict";
var jsdom = require("jsdom").jsdom;
global.document = jsdom(undefined, {});
global.window = document.defaultView;
global.Element = global.window.Element;
global.HTMLElement = global.window.HTMLElement;
var TemplateView = require('..');
var Model = require('backbone-model').Model;
var View = require('simple-view').View;
var template = require('lodash.template');
var sinon = require('sinon');
var assert = require('assert');
var assign = require('lodash.assign');
var slice = Array.prototype.slice;
describe("TemplateView", function () {
    var myTemplate;
    beforeEach(function () {
        myTemplate = template("<div class='first-inner'><div class='second-inner'></div></div>");
    });
    describe('template.local', function () {
        it('should post-compose css classnames in extended templates when local ends in __', function () {
            var ParentConstructor = TemplateView.extend({
                template: {
                    whatsthis: 'helloworld',
                    local: {
                        foo: 'parentFooLocalClassName'
                    }
                }
            });
            var ChildConstructor = ParentConstructor.extend({
                template__: {
                    local__: {
                        foo: 'childFooLocalClassName'
                    }
                }
            });
            assert.equal(
                ChildConstructor.prototype.template.local.foo,
                'parentFooLocalClassName childFooLocalClassName'
            );
        });
    });
    it('should have an element at this.el', function () {
        var myView = new TemplateView({
            template: template('hello world')
        });
        assert(myView.el);
    });
    it("should get scope from options first, then this", function () {
      
        var scope1 = sinon.spy(function () {return {};})
        var scope2 = sinon.spy(function () {return {};})
        var scope3 = sinon.spy(function () {return {};})
        new TemplateView({
            scope : scope1,
            template : myTemplate
        });
        sinon.assert.called(scope1);
        var Tv = TemplateView.extend({
            scope : scope2,
            template : myTemplate
        });
        sinon.assert.notCalled(scope2);
        new Tv({
            scope: scope3,
            template : myTemplate
        });
        sinon.assert.notCalled(scope2);
        sinon.assert.called(scope3);
    });
    it("should use the first element in the template if useInnerElement is specified as an option", function () {
        var tv = new TemplateView({
            template : myTemplate,
            useInnerElement : true
        });
        assert(tv.el);
        assert(tv.el.matches('.first-inner'));
        tv = new TemplateView({
            template : myTemplate,
            useInnerElement : false
        });
        assert.equal(tv.el.querySelectorAll('.first-inner').length, 1);
    });
    it("should use templateVars as the data for the template", function () {
        var renderedTemplate = false;
        var templateVars = {
            foo: 5,
            bar: 6
        };
        new TemplateView({
            templateVars: assign({}, templateVars),
            template: function (obj) {
                renderedTemplate = true;
                assert.deepEqual(obj, templateVars);
            }
        });
        assert(renderedTemplate);
        renderedTemplate = false;
        new (TemplateView.extend({
            templateVars: assign({}, templateVars),
            template: function (obj) {
                renderedTemplate = true;
                assert.deepEqual(obj, templateVars);
            }
        }))();
        assert(renderedTemplate);
    });
    it("should use the first element inside the template when useInnerElement is set to true", function () {
        var tv = new TemplateView({
            template: template("<div data-my-attr='its-mine'>hello world</div>"),
            useInnerElement: true
        });
        assert(tv.el);
        assert(tv.el.matches('[data-my-attr]'));
    });
    it("should use extendcompose to run the for subclass's templateVars method", function () {
        var tv1tvars = sinon.spy(function () {return {tv1vars: true};});
        var tv2tvars = sinon.spy(function () {return {tv2vars: true};});
        var TV1 = TemplateView.extend({ templateVars__ : tv1tvars });
        var TV2 = TV1.extend({ templateVars__ : tv2tvars });
        new TV2({
            template : template("<%- obj.foo %>"),
            model : new Model({foo: 5})
        });
        sinon.assert.called(tv1tvars);
        sinon.assert.called(tv2tvars);
    });
    it("should use the templateVars property passed as a constructor option in a scope-based view", function () {
        var tv1tvars = sinon.spy(function () {return {tv1vars: true};});
        var tv2tvars = sinon.spy(function () {return {tv2vars: true};});
        var bartvarsSpy = sinon.spy(function () {return {bartvar: 6};});
        var barConstructor = sinon.spy(function () {return {
            template: template("<%- obj.bartvar %>"),
            templateVars : bartvarsSpy
        };});
        var TV1 = TemplateView.extend({ templateVars__ : tv1tvars });
        var TV2 = TV1.extend({ templateVars__ : tv2tvars });
        new TV2({
            template : template("<div data-append='bar'></div><%- obj.foo %>"),
            model : new Model({foo: 5}),
            scope : {
                bar : barConstructor
            }
        });
        sinon.assert.called(barConstructor);
        sinon.assert.called(tv1tvars);
        sinon.assert.called(tv2tvars);
        sinon.assert.called(bartvarsSpy);
    });
    describe("subView appending", function () {
        var tv;
        var topLevelSubview;
        beforeEach(function () {
            var element = document.createElement('div');
            element.innerHTML = "top level subview";
            topLevelSubview = new View({el: element});
            tv = new TemplateView({
                template: {
                    useInnerElement: true,
                    src: template("<div data-append='topLevel'><div data-append='mySubviewAsView'></div><div data-append='mySubviewAsOptions'></div></div>")
                },
                scope: {
                    topLevel: topLevelSubview,
                    mySubviewAsView: new View(),
                    mySubviewAsOptions: {template: template("hello world")}
                }
            });
        });
        it('should append to this.el if it matches a scope reference', function () {
            assert.equal(slice.call(tv.el.childNodes).filter(function (el) {
                return el === topLevelSubview.el;
            }).length, 1);
        });
        it("should append the views set in the scope map based on the data-append attributes of the elements in the rendered template", function () {
            assert(tv._subs.mySubviewAsView instanceof View);
            assert.equal(tv._subs.mySubviewAsView.el.parentNode, tv.$("[data-append=mySubviewAsView]")[0]);
            assert.equal(tv._subs.mySubviewAsOptions.el, tv.$("[data-append=mySubviewAsOptions]")[0]);
        });
        it("should use subView as constructor options for a new TemplateView if it does not resolve to an instance of View", function () {
            assert(tv._subs.mySubviewAsOptions instanceof TemplateView);
        });
        it('should append all subviews if the the subview is actually an array of subviews', function () {
            var firstView = new View();
            var secondView = new View();
            var MyView = TemplateView.extend({
                template: template("<div data-append='mySubs'></div>"),
                scope: function () {
                    return {
                        mySubs: [
                            firstView,
                            secondView
                        ]
                    };
                }
            });
            var myView = new MyView();
            assert(firstView.el.parentNode.parentNode);
            assert.equal(firstView.el.parentNode.parentNode, secondView.el.parentNode.parentNode);
            assert.equal(firstView.el.parentNode.parentNode.parentNode, myView.el);
        });
        it('should append subviews of array subviews in the correct location', function () {
            var subviewTemplate = template([
                "<div class='one' data-name='first-element'></div>",
                "<div class='two' data-append='foo'></div>",
                "<div class='three' data-name='third-element'></div>"
            ].join(''));
            var subsubviewTemplate = template("<div data-name='subsubviewelement'></div>");
            var firstViewOptions = {
                template: subviewTemplate,
                scope: {
                    foo: {
                        template: subsubviewTemplate
                    }
                }
            };
            var secondViewOptions = {
                template: subviewTemplate,
                scope: {
                    foo: {
                        template: subsubviewTemplate
                    }
                }
            };
            var MyView = TemplateView.extend({
                template: template("<div data-append='mySubs'></div>"),
                scope: function () {
                    return {
                        mySubs: [
                            firstViewOptions,
                            secondViewOptions
                        ]
                    };
                }
            });
            var myView = new MyView();
            var subViews = myView.getSubView('mySubs');
            var firstSubsubviewEl;
            var secondSubsubviewEl;
            assert.equal(subViews.length, 2);
            assert.notEqual(subViews[0].el, subViews[1].el);
            firstSubsubviewEl = subViews[0].el.querySelector('[data-append=foo] [data-name=subsubviewelement]');
            secondSubsubviewEl = subViews[1].el.querySelector('[data-append=foo] [data-name=subsubviewelement]');
            assert(firstSubsubviewEl);
            assert.strictEqual(
                firstSubsubviewEl.parentNode.previousSibling,
                subViews[0].el.querySelector('[data-name=first-element]')
            );
            assert.strictEqual(
                firstSubsubviewEl.parentNode.nextSibling,
                subViews[0].el.querySelector('[data-name=third-element]')
            );
            assert.strictEqual(
                secondSubsubviewEl.parentNode.previousSibling,
                subViews[1].el.querySelector('[data-name=first-element]')
            );
            assert.strictEqual(
                secondSubsubviewEl.parentNode.nextSibling, 
                subViews[1].el.querySelector('[data-name=third-element]')
            );
        });
    });
});

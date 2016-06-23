"use strict";

var result = require('lodash.result');
var assign = require('lodash.assign');
var map = require('lodash.map');
var forEach = require('lodash.foreach');
var isArray = require('lodash.isarray');
var isFunction = require('lodash.isfunction');
var mapValues = require('lodash.mapvalues');
var composeClassNames = require('compose-class-names');
var matches = require('matches-selector');
var View = require('simple-view').View;
var TemplateView = module.exports = require('extendcompose').withMiddleware({
    afterPrototype: function (parentPrototype, childPrototypeBefore, childPrototypeAfter) {
        if (!childPrototypeAfter.template) {
            return childPrototypeAfter;
        }
        var newLocalClassNames;
        if (childPrototypeAfter.template.local__) {
            newLocalClassNames = composeClassNames(
                childPrototypeAfter.template.local,
                childPrototypeAfter.template.local__
            );
        } else if (childPrototypeAfter.template.__local) {
            newLocalClassNames = composeClassNames(
                childPrototypeAfter.template.__local,
                childPrototypeAfter.template.local
            );
        } else {
            return undefined;
        }
        assign(childPrototypeAfter,
            {
                template: assign({},
                    childPrototypeAfter.template,
                    {
                        local: newLocalClassNames
                    }
                )
            }
        );
    }
}).call(View, {});
var normalizeToView = require('normalize-to-view'); // must come after TemplateView is defined in order to resolve circular dependency

var prototype = {
    templateVars: function () {
        return this.model ? this.model.toJSON() : {};
    },
    getSubElement : function (subViewKey) {
        var subSelector = "[data-append=" + subViewKey + "]";
        var subs = this.$(subSelector);
        if (matches(this.el, subSelector)) {
            subs = subs.concat([this.el]);
        }
        return subs[0];
    },
    getSubView : function (subViewKey) {
        return this._subs[subViewKey];
    },
    initialize: function (options) {
        var scope;
        var useInnerElement;
        var local;
        var renderedTemplate;
        options = options || {};
        scope = options.scope || this.scope || {};
        this.templateVars = options.templateVars || this.templateVars;
        this.template = options.template || this.template;
        if (!isFunction(this.template) && this.template instanceof Object) {
            useInnerElement = this.template.useInnerElement;
            local = this.template.local;
            this.template = this.template.src;
        }
        if (undefined === useInnerElement) {
            useInnerElement = useInnerElement || options.useInnerElement;
        }
        if (this.templateVars instanceof Function) {
            this.templateVars = this.templateVars.apply(this);
        }
        if (scope instanceof Function) {
            scope = scope.apply(this);
        }
        if (!this.template) {
            throw new Error("no template provided to template view");
        }
        if (local) {
            this.templateVars = assign({local: local}, this.templateVars);
        }
        renderedTemplate = this.template(this.templateVars);
        if (undefined === renderedTemplate) {
            renderedTemplate = "";
        }
        var innerElBuilder = document.createElement('div');
        innerElBuilder.innerHTML = renderedTemplate.trim();
        var innerEls = Array.prototype.slice.call(innerElBuilder.childNodes);
        if (useInnerElement) {
            if (innerEls.length !== 1) {
                throw new Error("useInnerElement requires template with a single root element. There are " + innerEls.length);
            }
            this.setElement(innerEls[0]);
        } else {
            innerEls.forEach(this.el.appendChild.bind(this.el));
        }
        this._subs = mapValues(scope, function (subViews, appendKey) {
            var el = this.getSubElement(appendKey);
            var wasArray = true;
            if (!el) {
                return undefined; // couldn't identify a subview parent
            }
            if (!isArray(subViews)) {
                subViews = [subViews];
                wasArray = false;
            }
            if (!subViews) {
                return undefined;
            }
            subViews = map(subViews, function (subView, i) {
                var innerEl = el;
                if (wasArray) {
                    innerEl = document.createElement(el.tagName);
                    innerEl.setAttribute('data-template-view-child', i);
                    el.appendChild(innerEl);
                }
                subView = normalizeToView({
                    defaultContext: this,
                    defaultParentElement: innerEl,
                    defaultTemplateVars: this.templateVars,
                    content: subView,
                    Constructor: this.defaultConstructor
                });
                if (false === subView) {
                    // TODO: test this
                    innerEl.parentNode.removeChild(innerEl);
                }
                if (!subView) {
                    return undefined;
                }
                if (innerEl !== subView.el) {
                    innerEl.appendChild(subView.el);
                }
                return subView;
            }.bind(this));
            if (!wasArray) {
                subViews = subViews[0];
            }
            if (this.subViewAppended) {
                this.subViewAppended(subViews);
            }
            if (!subViews) {
                return undefined;
            }
            return subViews;
        }.bind(this));
        return options;
    },
    render: function () {
        // overriding render so the subviews dont get blown away after initialize runs
        forEach(this._subs, function (subarray) {
            if (!isArray(subarray)) {
                subarray = [subarray];
            }
            forEach(subarray, function (sub) {
                result(sub, 'render');
            });
        });
        return this;
    }
};
TemplateView.extendSelf(assign(prototype, {
    defaultConstructor: TemplateView
}));

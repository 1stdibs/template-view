# template-view
TemplateView is a lightweight view for rapid prototyping with a concise syntax, use it when you don't care to create a bunch of subclasses just to show a set of mostly static templates.

##installation:
```sh
npm install --save template-view
```

##usage:
To render a model's `toJSON()` into a template and package it into a backbone-style view instance, it's just:

```js
const TemplateView = require('template-view');
new TemplateView({ // instantiating, not extending here; an instance of the object is ready to use
  template: myTemplate, // template can be passed through options or prototype
  model: myModel // model.toJSON gets passed to the template as data
});
```
You can also nest TemplateView configs inside of a `scope` property to build more complex views:
```js
new TemplateView({
  template: outerTemplate,
  model: outerModel,
  scope: {
    'sub-templateview-goes-here': { // plain objects as passed as the argument to `new TemplateView(/* right here */)`
      template innerTemplate
      model: innerModel
    },
    'not-a-template-view': new MyOtherView() // instances of a Backbone-style view get appended directly
  }
});
```
where outerTemplate is:
```html
<div>
    <div data-append='sub-templateview-goes-here'>
        <!-- subview gets appended here, the element is
             identified by the key in the TemplateView
             instance's scope map -->
    </div>
    <div data-append='not-a-template-view'>
        <!-- myOtherview instance gets appended here -->
    </div>
 </div>
```
some notes:
 - the template can be specified on the prototype or through options.
 - `this.model.toJSON()` is automatically offered as as the data for the template.
 - automatically appends subviews using a scope map, passed through prototype or options. Elements on which to append are declared with a `data-append=<name-in-scope>` attribute.


### `scope` object properties

TemplateView can take a _template specification_ either as a constructor option or on the prototype of a subclass. The template specification can have the following forms:

object

* `template` - When `template` is an underscore template, it is rendered to `this.el`. When it is an object, the properties defined below are respected. `template` can be specified as an option or on a subclass's prototype.
* `template.useInnerElement` - defaults to false. If true, then the first element in the template will be used as the element for the view, otherwise the template will be rendered into a wrapper element.
* `template.local` - a local-css map as exported by css-loader. It will be available as obj.local in your template.
* `template.src` - an underscore-style template
* `scope` - a map of subviews to append to subview parent elements. `scope` can be speficied as option or prototype. The keys of `scope` determine which element in the template the property will be rendered into, as specified by the elements `data-append` property. The properties of `scope` are interperited according to their type as follows:
 * `Function` - value is derived from execution
 * `Backbone-style View` - value is used directly
 * `Object` - options object used to construct a new TemplateView
 * `boolean` - if false, the container element will be detached
 * `templateVars` - An object or function that returns the object that will be injected into the template. Defaults to `this.model.toJSON()`

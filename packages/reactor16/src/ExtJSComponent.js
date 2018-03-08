import ReactDOM from 'react-dom';
import { l } from './index'
import React from 'react';
import { Component, Children, cloneElement } from 'react';
import EXTRenderer from './ReactEXT.js'
import union from 'lodash.union';
import isEqual from 'lodash.isequal';
import capitalize from 'lodash.capitalize'
import cloneDeepWith from 'lodash.clonedeepwith';

export class ExtJSComponent extends Component {
  constructor(element) {
    super(element)
    this.a = this.xtype;
    if (element.children == undefined || element.children == false ) {
      this.reactProps = element
      this.reactChildren = null
    }
    else {
      this.reactChildren = element.children
      if (element.props == undefined) {
        this.reactProps = element
      }
      else {
        this.reactProps = element.props
      }
    }
    l(`element`, element)
    l(`reactProps`, this.reactProps)
    l(`reactChildren`, this.reactChildren)

    this.cmp = null;
    this.el = null;
    // this._flags = null;
    // this._hostNode = null;
    // this._hostParent = null;
    // this._renderedChildren = null;
    // this._hostContainerInfo = null;
    // this._topLevelWrapper = null;
    // this.displayName = 'ExtJSComponent';
//    this.unmountSafely = false;

//    const config2 = this._createInitialConfig(this)

    var config = {}
    var props = this.reactProps
    config.xtype = this.xtype
    for (var key in props) {
      if(key.substr(0,2) === 'on') {
        var event = key.substr(2).toLowerCase()
        if (config.listeners == undefined) {
          config.listeners = {}
        }
        config.listeners[event] = props[key]
        //MetaData
      }
      else {
        config[key] = props[key]
        //MetaData
      }
    }
    if (this.isRootContainer) {
      config['fullscreen'] = true
      if (config['layout'] == undefined) {
        config['layout'] = 'fit'
      }
    }
    if (config['className'] != undefined) {
      if (config['cls'] != undefined) {
        config['cls'] = config['cls'] + ' ' + config['className']
      }
      else {
        config['cls'] = config['className']
      }
    }

    this.cmp = new this.extJSClass(config)
    this.cmp.$createdByReactor = true;
    //this.cmp.$reactorComponentName = componentName;
    l(`in ExtJSComponent constructor for ${this.target}, Ext.create ${this.xtype}`, config)
  }


  componentWillMount() {
    l(`componentWillMount ${this.target}`, this)
  }

  componentDidMount() {
    l(`componentDidMount ${this.target}`, this)
    if (this.isRoot) {
      //need to prevent more than one root - already done in reactify
      var root = document.getElementsByClassName('x-viewport-body-el')[0]
      this.cmp.render(root)
    }
    l(`call EXTRenderer.createContainer for ${this.target}, (cmp)`, this.cmp)
    this._mountNode = EXTRenderer.createContainer(this.cmp);
    l(`call EXTRenderer.updateContainer for ${this.target}, (children)`, this.reactChildren)
    EXTRenderer.updateContainer(this.reactChildren, this._mountNode, this);
  }

  componentDidUpdate(prevProps, prevState) {
    l('componentDidUpdate')
    if (this.isRoot) {
      EXTRenderer.updateContainer(this.reactChildren, this._mountNode, this);
    }
  }

  componentWillUnmount() {
    l('componentWillUnmount')
    EXTRenderer.updateContainer(null, this._mountNode, this);
  }

  render() {
    l('render')
    return null
  }


    /**
     * Returns the Ext JS component instance
     */
    getHostNode() {
      return this.el;
  }

  /**
   * Returns the Ext JS component instance
   */
  getPublicInstance() {
      return this.cmp;
  }

  // end react renderer methods

  _renderRootComponent(renderToDOMNode, config) {
      defaults(config, {
          height: '100%',
          width: '100%'
      });

      config.renderTo = renderToDOMNode;

      this.cmp = this.createExtJSComponent(config);

      if (Ext.isClassic) {
          this.cmp.el.on('resize', () => this.cmp && this.cmp.updateLayout());
          this.el = this.cmp.el.dom;
      } else {
          this.el = this.cmp.renderElement.dom;
      }

      return { node: this.el, children: [] };
  }

  _applyDefaults({ defaults, children }) {
      if (defaults) {
          return Children.map(children, child => {
              if (child.type.prototype instanceof ExtJSComponent) {
                  return cloneElement(child, { ...defaults, ...child.props })
              } else {
                  return child;
              }
          })
      } else {
          return children;
      }
  }

  /**
   * Creates an Ext JS component config from react element props
   * @private
   */
  _createInitialConfig(element) {
    debugger
      const { type, props } = element;
      const config = this._createConfig(props, true);
      this._ensureResponsivePlugin(config);

      const items = [], dockedItems = [];
      
      if (props.children) {
          //const children = this.mountChildren(this._applyDefaults(props), transaction, context);
          const children = props.children

          for (let i=0; i<children.length; i++) {
              const item = children[i];

              if (item instanceof Ext.Base) {
                  const prop = this._propForChildElement(item);

                  if (prop) {
                      item.$reactorConfig = true;
                      const value = config;

                      if (prop.array) {
                          let array = config[prop.name];
                          if (!array) array = config[prop.name] = [];
                          array.push(item);
                      } else {
                          config[prop.name] = prop.value || item;
                      }
                  } else {
                      (item.dock ? dockedItems : items).push(item);
                  }
              } else if (item.node) {
                  items.push(wrapDOMElement(item));
              } else if (typeof item === 'string') {
                  // will get here when rendering html elements in react-test-renderer
                  // no need to do anything
              } else {
                  throw new Error('Could not render child item: ' + item);
              }
          }
      }

      if (items.length) config.items = items;
      if (dockedItems.length) config.dockedItems = dockedItems;

      return config;
  }

  /**
   * Determines whether a child element corresponds to a config or a container item based on the presence of a rel config or
   * matching other known relationships
   * @param {Ext.Base} item
   */
  _propForChildElement(item) {
      if (item.config && item.config.rel) {
          if (typeof item.config.rel === 'string') {
              return { name: item.config.rel }
          } else {
              return item.config.rel;
          }
      }

      const { extJSClass } = this;

      if (isAssignableFrom(extJSClass, CLASS_CACHE.Button) && CLASS_CACHE.Menu && item instanceof CLASS_CACHE.Menu) {
          return { name: 'menu', array: false };
      } else if (isAssignableFrom(extJSClass, Ext.Component) && CLASS_CACHE.ToolTip && item instanceof CLASS_CACHE.ToolTip) {
          return { name: 'tooltip', array: false };
      } else if (CLASS_CACHE.Column && item instanceof CLASS_CACHE.Column) {
          return { name: 'columns', array: true };
      } else if (isAssignableFrom(extJSClass, CLASS_CACHE.Column) && CLASS_CACHE.CellBase && item instanceof CLASS_CACHE.CellBase) {
          return { name: 'cell', array: false, value: this._cloneConfig(item) }
      } else if (isAssignableFrom(extJSClass, CLASS_CACHE.WidgetCell)) {
          return { name: 'widget', array: false, value: this._cloneConfig(item) }
      } else if (isAssignableFrom(extJSClass, CLASS_CACHE.Dialog) && CLASS_CACHE.Button && item instanceof CLASS_CACHE.Button) {
          return { name: 'buttons', array: true };
      } else if (isAssignableFrom(extJSClass, CLASS_CACHE.Column) && CLASS_CACHE.Field && item instanceof CLASS_CACHE.Field) {
          return { name: 'editor', array: false, value: this._cloneConfig(item) };
      }
  }

  _cloneConfig(item) {
      return { ...item.initialConfig, xclass: item.$className };
  }

  /**
   * If the propName corresponds to an event listener (starts with "on" followed by a capital letter), returns the name of the event.
   * @param {String} propName 
   * @param {String}
   */
  _eventNameForProp(propName) {
      if (propName.match(/^on[A-Z]/)) {
          return propName.slice(2).toLowerCase();
      } else {
          return null;
      }
  }

  /**
   * Creates an Ext config object for this specified props
   * @param {Object} props
   * @param {Boolean} [includeEvents] true to convert on* props to listeners, false to exclude them
   * @private
   */
  _createConfig(props, includeEvents) {
      props = this._cloneProps(props);

      const config = {};

      if (includeEvents) config.listeners = {};

      for (let key in props) {
          if (props.hasOwnProperty(key)) {
              const value = props[key];
              const eventName = this._eventNameForProp(key);

              if (eventName) {
                  if (value && includeEvents) config.listeners[eventName] = value;
              } else if (key === 'config') {
                  Object.assign(config, value);
              } else if (key !== 'children' && key !== 'defaults') {
                  config[key.replace(/className/, 'cls')] = value;
              }
          }
      }

      const { extJSClass } = this;

      //need this
      // if (isAssignableFrom(extJSClass, CLASS_CACHE.Column) && typeof config.renderer === 'function' && CLASS_CACHE.RendererCell) {
      //     config.cell = config.cell || {};
      //     config.cell.xtype = 'renderercell';
      // }

      return config;
  }

  _ensureResponsivePlugin(config) {
      if (config.responsiveConfig) {
          const { plugins } = config;

          if (plugins == null) {
              config.plugins = 'responsive';
          } else if (Array.isArray(plugins) && plugins.indexOf('responsive') === -1) {
              plugins.push('responsive');
          } else if (typeof plugins === 'string') {
              if (plugins !== 'responsive') {
                  config.plugins = [plugins, 'responsive'];
              }
          } else if (!plugins.resposive) {
              plugins.responsive = true;
          }
      }
  }

  /**
   * Cloning props rather than passing them directly on as configs fixes issues where Ext JS mutates configs during
   * component initialization.  One example of this is grid columns get $initParent added when the grid initializes.
   * @param {Object} props
   * @private
   */
  _cloneProps(props) {
      return cloneDeepWith(props, value => {
          if (value instanceof Ext.Base || typeof(value) === 'function') {
              return value;
          }
      })
  }

  _rushProps(oldProps, newProps) {
      const rushConfigs = this.extJSClass.__reactorUpdateConfigsBeforeChildren;
      if (!rushConfigs) return;
      const oldConfigs = {}, newConfigs = {}

      for (let name in rushConfigs) {
          oldConfigs[name] = oldProps[name];
          newConfigs[name] = newProps[name]
      }

      this._applyProps(oldConfigs, newConfigs);
  }

  /**
   * Calls config setters for all react props that have changed
   * @private
   */
  _applyProps(oldProps, props) {
      const keys = union(Object.keys(oldProps), Object.keys(props));

      for (let key of keys) {
          const oldValue = oldProps[key], newValue = props[key];

          if (key === 'children') continue;

          if (!isEqual(oldValue, newValue)) {
              const eventName = this._eventNameForProp(key);

              if (eventName) {
                  this._replaceEvent(eventName, oldValue, newValue);
              } else {
                  const setter = this._setterFor(key);

                  if (setter) {
                      const value = this._cloneProps(newValue);
                      if (this.reactorSettings.debug) console.log(setter, newValue);
                      this.cmp[setter](value);
                  }
              }
          }
      }
  }

  /**
   * Detaches the old event listener and adds the new one.
   * @param {String} eventName 
   * @param {Function} oldHandler 
   * @param {Function} newHandler 
   */
  _replaceEvent(eventName, oldHandler, newHandler) {
      if (oldHandler) {
          if (this.reactorSettings.debug) console.log(`detaching old listener for ${eventName}`);
          this.cmp.un(eventName, oldHandler);
      }

      if (this.reactorSettings.debug) console.log(`attaching new listener for ${eventName}`);
      this.cmp.on(eventName, newHandler);
  }

  /**
   * Returns the name of the setter method for a given prop.
   * @param {String} prop
   */
  _setterFor(prop) {
      if (prop === 'className') {
          prop = 'cls';
      }
      const name = `set${this._capitalize(prop)}`;
      return this.cmp[name] && name;
  }

  /**
   * Returns the name of a getter for a given prop.
   * @param {String} prop
   */
  _getterFor(prop) {
      const name = `get${this._capitalize(prop)}`;
      return this.cmp[name] && name;
  }

  /**
   * Capitalizes the first letter in the string
   * @param {String} str
   * @return {String}
   * @private
   */
  _capitalize(str) {
      return capitalize(str[0]) + str.slice(1);
  }

  _precacheNode() {
      this._flags |= Flags.hasCachedChildNodes;

      if (this.el) {
          // will get here when rendering root component
          precacheNode(this, this.el)
      } else if (this.cmp.el) {
          this._doPrecacheNode();
      } else if (Ext.isClassic) {
          // we get here when rendering child components due to lazy rendering
          this.cmp.on('afterrender', this._doPrecacheNode, this, { single: true });
      }
  }

  _doPrecacheNode() {
      this.el = this.cmp.el.dom;
      this.el._extCmp = this.cmp;
      precacheNode(this, this.el)
  }

  /**
   * Returns the child item at the given index, only counting those items which were created by Reactor
   * @param {Number} n
   */
  _toReactChildIndex(n) {
      let items = this.cmp.items;

      if (!items) return n;
      if (items.items) items = items.items;

      let found=0, i, item;

      for (i=0; i<items.length; i++) {
          item = items[i];

          if (item.$createdByReactor && found++ === n) {
              return i;
          }
      }

      return i;
  }

  /**
   * Translates and index in props.children to an index within a config value that is an array.  Use
   * this to determine the position of an item in props.children within the array config to which it is mapped.
   * @param {*} prop
   * @param {*} indexInChildren
   */
  _toArrayConfigIndex(prop, indexInChildren) {
      let i=0, found=0;

      Children.forEach(this.props.children, child => {
          const propForChild = this._propForChildElement(child);

          if (propForChild && propForChild.name === prop.name) {
              if (i === indexInChildren) return found;
              found++;
          }
      });

      return -1;
  }

  /**
   * Updates a config based on a child element
   * @param {Object} prop The prop descriptor (name and array)
   * @param {Ext.Base} value The value to set
   * @param {Number} [index] The index of the child element in props.children
   * @param {Boolean} [isArrayDelete=false] True if removing the item from an array
   */
  _mergeConfig(prop, value, index, isArrayDelete) {
      const setter = this._setterFor(prop.name);
      if (!setter) return;

      if (value) value.$reactorConfig = true;

      if (prop.array) {
          const getter = this._getterFor(prop.name);
          if (!getter) return;

          const currentValue = this.cmp[getter]() || [];

          if (isArrayDelete) {
              // delete
              value = currentValue.filter(item => item !== value);
          } else if (index !== undefined) {
              // move
              value = currentValue.filter(item => item !== value);
              value = value.splice(this._toArrayConfigIndex(index, prop), 0, item);
          } else {
              // append
              value = currentValue.concat(value);
          }
      }

      if (this.reactorSettings.debug) console.log(setter, value);

      this.cmp[setter](value);
  }

  _ignoreChildrenOrder() {
      // maintaining order in certain components, like Transition's container, can cause problems with animations, _reactorIgnoreOrder gives us a way to opt out in such scenarios
      if (this.cmp._reactorIgnoreOrder) return true; 

      // moving the main child of a container with layout fit causes it to disappear.  Instead we do nothing, which
      // should be ok because fit containers are not ordered
      if (CLASS_CACHE.FitLayout && this.cmp.layout instanceof CLASS_CACHE.FitLayout) return true; 

      // When tab to the left of the active tab is removed, the left-most tab would always be selected as the tabs to the right are reinserted
      if (CLASS_CACHE.TabPanel && this.cmp instanceof CLASS_CACHE.TabPanel) return true;
  }
}



/**
 * Wraps a dom element in an Ext Component so it can be added as a child item to an Ext Container.  We attach
 * a reference to the generated Component to the dom element so it can be destroyed later if the dom element
 * is removed when rerendering
 * @param {Object} node A React node object with node, children, and text
 * @returns {Ext.Component}
 */
function wrapDOMElement(node) {
  let contentEl = node.node;

  const cmp = new Ext.Component({ 
      // We give the wrapper component a class so that developers can reset css 
      // properties (ex. box-sizing: context-box) for third party components.
      cls: 'x-react-element' 
  });
  
  if (cmp.element) {
      // modern
      DOMLazyTree.insertTreeBefore(cmp.element.dom, node);
  } else {
      // classic
      const target = document.createElement('div');
      DOMLazyTree.insertTreeBefore(target, node);
      cmp.contentEl = contentEl instanceof HTMLElement ? contentEl : target /* text fragment or comment */;
  }

  cmp.$createdByReactor = true;
  contentEl._extCmp = cmp;

  // this is needed for devtools when using dangerouslyReplaceNodeWithMarkup
  // this not needed in fiber
  cmp.node = contentEl;

  return cmp;
}
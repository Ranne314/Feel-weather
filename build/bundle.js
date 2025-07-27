
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { document: document_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let title_value;
    	let style;
    	let t1;
    	let main;
    	let button;
    	let t2_value = (/*darkMode*/ ctx[12] ? '☀️ Light Mode' : '🌙 Dark Mode') + "";
    	let t2;
    	let t3;
    	let h1;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let p0;
    	let strong0;
    	let t9;
    	let t10;
    	let t11;
    	let p1;
    	let strong1;
    	let t13;
    	let t14;
    	let t15;
    	let p2;
    	let strong2;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let p3;
    	let strong3;
    	let t23;
    	let t24;
    	let t25;
    	let t26;
    	let t27;
    	let p4;
    	let strong4;
    	let t29;
    	let t30;
    	let t31;
    	let p5;
    	let strong5;
    	let t33;
    	let t34;
    	let t35;
    	let p6;
    	let strong6;
    	let t37;
    	let t38;
    	let mounted;
    	let dispose;
    	document_1.title = title_value = /*name*/ ctx[0];

    	const block = {
    		c: function create() {
    			style = element("style");
    			style.textContent = ":root {\n            --bg-color: #ffffff;\n            --text-color: #333333;\n            --card-bg: linear-gradient(to bottom, #f5fafd, #e0f7fa);\n            --card-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);\n        }\n        \n        .dark {\n            --bg-color: #1a1a1a;\n            --text-color: #f0f0f0;\n            --card-bg: linear-gradient(to bottom, #2d3748, #1a202c);\n            --card-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);\n        }\n        \n        body {\n            background-color: var(--bg-color);\n            color: var(--text-color);\n            transition: background-color 0.3s ease, color 0.3s ease;\n        }";
    			t1 = space();
    			main = element("main");
    			button = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			h1 = element("h1");
    			t4 = text(/*conditionEmoji*/ ctx[9]);
    			t5 = text(" Weather in ");
    			t6 = text(/*city*/ ctx[3]);
    			t7 = space();
    			p0 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Latitude:";
    			t9 = space();
    			t10 = text(/*latitude*/ ctx[1]);
    			t11 = space();
    			p1 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Longitude:";
    			t13 = space();
    			t14 = text(/*longitude*/ ctx[2]);
    			t15 = space();
    			p2 = element("p");
    			strong2 = element("strong");
    			strong2.textContent = "Temperature:";
    			t17 = space();
    			t18 = text(/*temperature*/ ctx[4]);
    			t19 = space();
    			t20 = text(/*tempEmojiDisplay*/ ctx[10]);
    			t21 = space();
    			p3 = element("p");
    			strong3 = element("strong");
    			strong3.textContent = "Feels Like:";
    			t23 = space();
    			t24 = text(/*feelsLikeTemp*/ ctx[8]);
    			t25 = space();
    			t26 = text(/*feelsEmojiDisplay*/ ctx[11]);
    			t27 = space();
    			p4 = element("p");
    			strong4 = element("strong");
    			strong4.textContent = "Humidity:";
    			t29 = space();
    			t30 = text(/*humidity*/ ctx[6]);
    			t31 = space();
    			p5 = element("p");
    			strong5 = element("strong");
    			strong5.textContent = "Wind Speed:";
    			t33 = space();
    			t34 = text(/*windSpeed*/ ctx[5]);
    			t35 = space();
    			p6 = element("p");
    			strong6 = element("strong");
    			strong6.textContent = "Condition:";
    			t37 = space();
    			t38 = text(/*condition*/ ctx[7]);
    			add_location(style, file, 162, 4, 5687);
    			attr_dev(button, "class", "dark-mode-toggle svelte-tu9awl");
    			add_location(button, file, 186, 4, 6374);
    			attr_dev(h1, "class", "svelte-tu9awl");
    			add_location(h1, file, 190, 4, 6511);
    			add_location(strong0, file, 191, 7, 6562);
    			attr_dev(p0, "class", "svelte-tu9awl");
    			add_location(p0, file, 191, 4, 6559);
    			add_location(strong1, file, 192, 7, 6611);
    			attr_dev(p1, "class", "svelte-tu9awl");
    			add_location(p1, file, 192, 4, 6608);
    			add_location(strong2, file, 193, 7, 6662);
    			attr_dev(p2, "class", "svelte-tu9awl");
    			add_location(p2, file, 193, 4, 6659);
    			add_location(strong3, file, 194, 7, 6736);
    			attr_dev(p3, "class", "svelte-tu9awl");
    			add_location(p3, file, 194, 4, 6733);
    			add_location(strong4, file, 195, 7, 6812);
    			attr_dev(p4, "class", "svelte-tu9awl");
    			add_location(p4, file, 195, 4, 6809);
    			add_location(strong5, file, 196, 7, 6861);
    			attr_dev(p5, "class", "svelte-tu9awl");
    			add_location(p5, file, 196, 4, 6858);
    			add_location(strong6, file, 197, 7, 6913);
    			attr_dev(p6, "class", "svelte-tu9awl");
    			add_location(p6, file, 197, 4, 6910);
    			attr_dev(main, "class", "svelte-tu9awl");
    			add_location(main, file, 185, 0, 6363);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document_1.head, style);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, button);
    			append_dev(button, t2);
    			append_dev(main, t3);
    			append_dev(main, h1);
    			append_dev(h1, t4);
    			append_dev(h1, t5);
    			append_dev(h1, t6);
    			append_dev(main, t7);
    			append_dev(main, p0);
    			append_dev(p0, strong0);
    			append_dev(p0, t9);
    			append_dev(p0, t10);
    			append_dev(main, t11);
    			append_dev(main, p1);
    			append_dev(p1, strong1);
    			append_dev(p1, t13);
    			append_dev(p1, t14);
    			append_dev(main, t15);
    			append_dev(main, p2);
    			append_dev(p2, strong2);
    			append_dev(p2, t17);
    			append_dev(p2, t18);
    			append_dev(p2, t19);
    			append_dev(p2, t20);
    			append_dev(main, t21);
    			append_dev(main, p3);
    			append_dev(p3, strong3);
    			append_dev(p3, t23);
    			append_dev(p3, t24);
    			append_dev(p3, t25);
    			append_dev(p3, t26);
    			append_dev(main, t27);
    			append_dev(main, p4);
    			append_dev(p4, strong4);
    			append_dev(p4, t29);
    			append_dev(p4, t30);
    			append_dev(main, t31);
    			append_dev(main, p5);
    			append_dev(p5, strong5);
    			append_dev(p5, t33);
    			append_dev(p5, t34);
    			append_dev(main, t35);
    			append_dev(main, p6);
    			append_dev(p6, strong6);
    			append_dev(p6, t37);
    			append_dev(p6, t38);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*toggleDarkMode*/ ctx[13], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1 && title_value !== (title_value = /*name*/ ctx[0])) {
    				document_1.title = title_value;
    			}

    			if (dirty & /*darkMode*/ 4096 && t2_value !== (t2_value = (/*darkMode*/ ctx[12] ? '☀️ Light Mode' : '🌙 Dark Mode') + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*conditionEmoji*/ 512) set_data_dev(t4, /*conditionEmoji*/ ctx[9]);
    			if (dirty & /*city*/ 8) set_data_dev(t6, /*city*/ ctx[3]);
    			if (dirty & /*latitude*/ 2) set_data_dev(t10, /*latitude*/ ctx[1]);
    			if (dirty & /*longitude*/ 4) set_data_dev(t14, /*longitude*/ ctx[2]);
    			if (dirty & /*temperature*/ 16) set_data_dev(t18, /*temperature*/ ctx[4]);
    			if (dirty & /*tempEmojiDisplay*/ 1024) set_data_dev(t20, /*tempEmojiDisplay*/ ctx[10]);
    			if (dirty & /*feelsLikeTemp*/ 256) set_data_dev(t24, /*feelsLikeTemp*/ ctx[8]);
    			if (dirty & /*feelsEmojiDisplay*/ 2048) set_data_dev(t26, /*feelsEmojiDisplay*/ ctx[11]);
    			if (dirty & /*humidity*/ 64) set_data_dev(t30, /*humidity*/ ctx[6]);
    			if (dirty & /*windSpeed*/ 32) set_data_dev(t34, /*windSpeed*/ ctx[5]);
    			if (dirty & /*condition*/ 128) set_data_dev(t38, /*condition*/ ctx[7]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			detach_dev(style);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(main);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function tempEmoji(tempC) {
    	if (tempC <= -20) return '🧊';
    	if (tempC > -20 && tempC <= 0) return '❄️';
    	if (tempC > 0 && tempC <= 10) return '🥶';
    	if (tempC > 10 && tempC <= 20) return '😌';
    	if (tempC > 20 && tempC <= 30) return '🫠';
    	if (tempC > 30 && tempC <= 40) return '🥵';
    	return '🔥';
    }

    function feelsLikeEmoji(tempC) {
    	return tempEmoji(tempC); // im lazy
    }

    function feelsLike(tempC, humidityPercent, windKph) {
    	const tempF = tempC * 9 / 5 + 32;

    	if (tempC <= 10 && windKph > 4.8) {
    		const windChillC = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKph, 0.16) + 0.3965 * tempC * Math.pow(windKph, 0.16);
    		return `${windChillC.toFixed(1)} °C (Wind Chill)`;
    	}

    	if (tempC >= 27 && humidityPercent >= 40) {
    		const HI_F = -42.379 + 2.049 * tempF + 10.143 * humidityPercent - 0.225 * tempF * humidityPercent - 0.007 * Math.pow(tempF, 2) - 0.055 * Math.pow(humidityPercent, 2) + 0.00123 * Math.pow(tempF, 2) * humidityPercent + 0.00085 * tempF * Math.pow(humidityPercent, 2) - 0.000002 * Math.pow(tempF, 2) * Math.pow(humidityPercent, 2);
    		const HI_C = (HI_F - 32) * 5 / 9;
    		return `${HI_C.toFixed(1)} °C (Heat Index)`;
    	}

    	return `${tempC.toFixed(1)} °C (Actual)`;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { name } = $$props;
    	let latitude = 22.3964; // default for Hong Kong
    	let longitude = 114.1095;
    	let city = 'Detecting...';
    	let temperature = 'Loading...';
    	let windSpeed = 'Loading...';
    	let humidity = 'Loading...';
    	let condition = 'Loading...';
    	let feelsLikeTemp = 'Calculating...';
    	let conditionEmoji = '';
    	let tempEmojiDisplay = '';
    	let feelsEmojiDisplay = '';
    	let darkMode = true;

    	const weatherCodes = {
    		0: { desc: 'Clear sky', emoji: '☀️' },
    		1: { desc: 'Mainly clear', emoji: '🌤️' },
    		2: { desc: 'Partly cloudy', emoji: '⛅' },
    		3: { desc: 'Overcast', emoji: '☁️' },
    		45: { desc: 'Fog', emoji: '🌫️' },
    		48: { desc: 'Rime fog', emoji: '🌫️' },
    		51: { desc: 'Light drizzle', emoji: '🌦️' },
    		61: { desc: 'Light rain', emoji: '🌧️' },
    		71: { desc: 'Light snow', emoji: '🌨️' },
    		80: { desc: 'Rain showers', emoji: '🌦️' },
    		95: { desc: 'Thunderstorm', emoji: '⛈️' }
    	};

    	function toggleDarkMode() {
    		$$invalidate(12, darkMode = !darkMode);
    		localStorage.setItem('darkMode', darkMode);
    		applyDarkMode();
    	}

    	function applyDarkMode() {
    		if (typeof document !== 'undefined') {
    			document.documentElement.classList.toggle('dark', darkMode);
    		}
    	}

    	function applyWeather(data) {
    		$$invalidate(4, temperature = data.temperature);
    		$$invalidate(5, windSpeed = data.windSpeed);
    		$$invalidate(6, humidity = data.humidity);
    		$$invalidate(7, condition = data.condition);
    		$$invalidate(9, conditionEmoji = data.conditionEmoji);
    		$$invalidate(10, tempEmojiDisplay = data.tempEmojiDisplay);
    		$$invalidate(8, feelsLikeTemp = data.feelsLikeTemp);
    		$$invalidate(11, feelsEmojiDisplay = data.feelsEmojiDisplay);
    	}

    	async function fetchWeather(lat, lon) {
    		const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m`);
    		const data = await res.json();
    		const weatherCode = data.current_weather.weathercode;
    		const rawTemp = data.current_weather.temperature;
    		const rawWind = data.current_weather.windspeed;
    		const rawHumidity = data.hourly.relative_humidity_2m?.[0] || 50;
    		$$invalidate(4, temperature = `${rawTemp} °C`);
    		$$invalidate(5, windSpeed = `${rawWind} km/h`);
    		$$invalidate(6, humidity = `${rawHumidity}%`);
    		$$invalidate(7, condition = weatherCodes[weatherCode]?.desc || 'Unknown');
    		$$invalidate(9, conditionEmoji = weatherCodes[weatherCode]?.emoji || '');
    		$$invalidate(10, tempEmojiDisplay = tempEmoji(rawTemp));
    		$$invalidate(8, feelsLikeTemp = feelsLike(rawTemp, rawHumidity, rawWind));
    		$$invalidate(11, feelsEmojiDisplay = feelsLikeEmoji(rawTemp));

    		localStorage.setItem('info', JSON.stringify({
    			latitude,
    			longitude,
    			temperature,
    			windSpeed,
    			humidity,
    			condition,
    			conditionEmoji,
    			tempEmojiDisplay,
    			feelsLikeTemp,
    			feelsEmojiDisplay
    		}));
    	}

    	onMount(async () => {
    		const savedDarkMode = localStorage.getItem('darkMode') === 'true';

    		if (savedDarkMode) {
    			$$invalidate(12, darkMode = true);
    			applyDarkMode();
    		}

    		try {
    			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    			const rawCity = timeZone.split('/').pop() || 'Unknown';
    			$$invalidate(3, city = rawCity.replace(/_/g, ' '));

    			// You can optionally update latitude and longitude based on city if you want to expand
    			// For now, we just keep defaults and use city string for display
    			const cached = JSON.parse(localStorage.getItem('info'));

    			if (cached && Math.abs(cached.latitude - latitude) < 0.01 && Math.abs(cached.longitude - longitude) < 0.01) {
    				applyWeather(cached);
    			} else {
    				await fetchWeather(latitude, longitude);
    			}
    		} catch(error) {
    			$$invalidate(3, city = 'Hong Kong (fallback)');
    			$$invalidate(1, latitude = 22.3962);
    			$$invalidate(2, longitude = 114.1094);
    			await fetchWeather(latitude, longitude);
    		}
    	});

    	$$self.$$.on_mount.push(function () {
    		if (name === undefined && !('name' in $$props || $$self.$$.bound[$$self.$$.props['name']])) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	});

    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		name,
    		latitude,
    		longitude,
    		city,
    		temperature,
    		windSpeed,
    		humidity,
    		condition,
    		feelsLikeTemp,
    		conditionEmoji,
    		tempEmojiDisplay,
    		feelsEmojiDisplay,
    		darkMode,
    		weatherCodes,
    		toggleDarkMode,
    		applyDarkMode,
    		tempEmoji,
    		feelsLikeEmoji,
    		feelsLike,
    		applyWeather,
    		fetchWeather
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('latitude' in $$props) $$invalidate(1, latitude = $$props.latitude);
    		if ('longitude' in $$props) $$invalidate(2, longitude = $$props.longitude);
    		if ('city' in $$props) $$invalidate(3, city = $$props.city);
    		if ('temperature' in $$props) $$invalidate(4, temperature = $$props.temperature);
    		if ('windSpeed' in $$props) $$invalidate(5, windSpeed = $$props.windSpeed);
    		if ('humidity' in $$props) $$invalidate(6, humidity = $$props.humidity);
    		if ('condition' in $$props) $$invalidate(7, condition = $$props.condition);
    		if ('feelsLikeTemp' in $$props) $$invalidate(8, feelsLikeTemp = $$props.feelsLikeTemp);
    		if ('conditionEmoji' in $$props) $$invalidate(9, conditionEmoji = $$props.conditionEmoji);
    		if ('tempEmojiDisplay' in $$props) $$invalidate(10, tempEmojiDisplay = $$props.tempEmojiDisplay);
    		if ('feelsEmojiDisplay' in $$props) $$invalidate(11, feelsEmojiDisplay = $$props.feelsEmojiDisplay);
    		if ('darkMode' in $$props) $$invalidate(12, darkMode = $$props.darkMode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		latitude,
    		longitude,
    		city,
    		temperature,
    		windSpeed,
    		humidity,
    		condition,
    		feelsLikeTemp,
    		conditionEmoji,
    		tempEmojiDisplay,
    		feelsEmojiDisplay,
    		darkMode,
    		toggleDarkMode
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'Feel-weather',
    		version: '1.0'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

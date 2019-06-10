class Dep {
    constructor() {
        this.subs = []; // 存放所有 watcher
    }
    // 订阅
    addSub(watcher) {
        this.subs.push(watcher)
    }
    // 发布
    notify() {
        this.subs.forEach(watcher => watcher.update());
    }
}

// 观察者 被观察者
class Watcher {
    constructor(vm, expr, cb) {
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        this.oldValue = this.get(); // 存放老值
    }
    get() {
        Dep.target = this;
        let value = CompileUtil.getVal(this.vm, this.expr);
        Dep.target = null;
        return value;
    }
    update() { // 数据更新
        let newVal = CompileUtil.getVal(this.vm, this.expr);
        if (newVal !== this.oldValue) {
            this.cb(newVal);
        }
    }
}

// 数据劫持
class Observer {
    constructor(data) {
        this.observer(data);
    }
    observer(data) {
        if (data && typeof data == 'object') {
            for (let key in data) {
                this.defineReactive(data, key, data[key]);
            }
        }
    }
    defineReactive(obj, key, value) {
        this.observer(value);
        let dep = new Dep(); // 给每个属性添加订阅发布功能
        Object.defineProperty(obj, key, {
            get() {
                Dep.target && dep.addSub(Dep.target); // 创建 watcher 时取到对应内容，并将 watcher 放到全局
                return value;
            },
            set: (newVal) => {
                if (newVal != value) {
                    this.observer(newVal);
                    value = newVal;
                    dep.notify();
                }
            }
        });
    }
}

class Compiler {
    constructor(el, vm) {
        this.vm = vm;

        // 判断 el 是不是元素，如果不是则获取
        this.el = this.isElementNode(el) ? el : document.querySelector(el);

        // 获取当前节点中的元素，并放到内存中
        let fragment = this.node2fragment(this.el);

        // 编译模板
        this.compiler(fragment);

        // 将内容重新返回给页面
        this.el.appendChild(fragment);
    }

    // 判断是否有指令
    isDirective(attrName) {
        return attrName.startsWith('v-');
    }

    // 编译元素
    compileElement(node) {
        let attributes = node.attributes;
        [...attributes].forEach(attr => {
            let {
                name,
                value: expr
            } = attr;
            if (this.isDirective(name)) {
                let [, directive] = name.split('-');
                let [directiveName, eventName] = directive.split(':');
                CompileUtil[directiveName](node, expr, this.vm, eventName);
            }
        });
    }

    // 编译文本
    compileText(node) {
        let content = node.textContent;
        if (/\{\{(.+?)\}\}/.test(content)) {
            CompileUtil['text'](node, content, this.vm);
        }
    }

    // 核心编译方法，编译内存中的 dom 节点
    compiler(node) {
        let childNodes = node.childNodes;
        [...childNodes].forEach(child => {
            if (this.isElementNode(child)) {
                this.compileElement(child);
                // 递归编译
                this.compiler(child);
            } else {
                this.compileText(child);
            }
        });
    }

    // 把节点移动到内存中
    node2fragment(node) {
        // 创建节点碎片
        let fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = node.firstChild) {
            // appendChild具有移动性
            fragment.appendChild(firstChild);
        }
        return fragment;
    }

    // 判断是否为文档元素
    isElementNode(node) {
        return node.nodeType === 1;
    }
}

CompileUtil = {
    getVal(vm, expr) {
        let str = expr.replace(/\s*/g, "");
        return str.split('.').reduce((data, current) => {
            return data[current];
        }, vm.$data);
    },
    setVal(vm, expr, value) { // 给 vm 的 expr 赋新值 value
        let str = expr.replace(/\s*/g, "");
        return str.split('.').reduce((data, current, index, arr) => {
            if (index == arr.length - 1) {
                return data[current] = value;
            }
            return data[current];
        }, vm.$data);
    },
    // 解析 v-html 指令
    html(node, expr, vm) { // 节点、表达式、实例
        let fn = this.updater['htmlUpdater'];
        new Watcher(vm, expr, (newVal) => {
            fn(node, newVal);
        });
        let value = this.getVal(vm, expr);
        fn(node, value);
    },
    // 解析 v-model 指令
    model(node, expr, vm) { // 节点、表达式、实例
        let fn = this.updater['modelUpdater'];
        new Watcher(vm, expr, (newVal) => { // 给元素添加观察者，赋新值
            fn(node, newVal);
        });
        node.addEventListener('input', (e) => {
            let value = e.target.value;
            this.setVal(vm, expr, value);
        });
        let value = this.getVal(vm, expr);
        fn(node, value);
    },
    // 解析 v-on 指令
    on(node, expr, vm, eventName) {
        node.addEventListener(eventName, (e) => {
            vm[expr].call(vm, e);
        });
    },
    getContentValue(vm, expr) {
        // 将所有表达式内容更新 返回
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1]);
        });
    },
    text(node, expr, vm) {
        let fn = this.updater['textUpdater'];
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            new Watcher(vm, args[1], (newVal) => { // 给每个表达式({{}})添加观察者
                fn(node, this.getContentValue(vm, expr)); // 返回全部表达式({{}})
            });
            return this.getVal(vm, args[1]);
        });
        fn(node, content);
    },
    updater: {
        htmlUpdater(node, value) {
            node.innerHTML = value;
        },
        modelUpdater(node, value) {
            node.value = value;
        },
        textUpdater(node, value) {
            node.textContent = value;
        }
    }
}

// 基类，负责调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods;

        if (this.$el) {
            // 将数据转化成 用 Object.defineProperty 定义
            new Observer(this.$data);

            for (let key in computed) {
                Object.defineProperty(this.$data, key, {
                    get: () => {
                        return computed[key].call(this);
                    }
                });
            };

            for (let key in methods) {
                Object.defineProperty(this, key, {
                    get() {
                        return methods[key];
                    }
                });
            };

            // vm 代理 vm.$data
            this.proxyVm(this.$data);

            // console.log(this.$data);
            new Compiler(this.$el, this);
        }
    }
    proxyVm(data) {
        for (let key in data) {
            Object.defineProperty(this, key, {
                get() {
                    return data[key];
                },
                set(newVal) {
                    data[key] = newVal;
                }
            });
        }
    }
}
/** @odoo-module **/

import { registry } from "@web/core/registry";

export class QuickActionsService {
    constructor() {
        this.actions = new Map();
        this.contexts = new Map();
        this.permissions = null;
    }
    
    // Register actions for specific contexts
    registerActions(context, actions) {
        this.actions.set(context, actions);
    }
    
    // Get actions for specific context
    getActionsForContext(context) {
        const actions = this.actions.get(context) || [];
        return this.filterActionsByPermissions(actions);
    }
    
    // Filter actions based on permissions
    filterActionsByPermissions(actions) {
        if (!this.permissions) return actions;
        
        return actions.filter(action => {
            if (!action.permission) return true;
            return this.permissions[action.permission] === true;
        });
    }
    
    // Set user permissions
    setPermissions(permissions) {
        this.permissions = permissions;
    }
    
    // Get permission status
    hasPermission(permission) {
        if (!this.permissions) return true;
        return this.permissions[permission] === true;
    }
    
    // Create standard Odoo action
    createOdooAction(model, options = {}) {
        const defaultOptions = {
            type: 'ir.actions.act_window',
            res_model: model,
            view_mode: 'list,form',
            target: 'current'
        };
        
        return { ...defaultOptions, ...options };
    }
    
    // Create form action
    createFormAction(model, context = {}) {
        return this.createOdooAction(model, {
            view_mode: 'form',
            target: 'new',
            context: context
        });
    }
    
    // Create list action
    createListAction(model, domain = [], context = {}) {
        return this.createOdooAction(model, {
            view_mode: 'list,form',
            domain: domain,
            context: context
        });
    }
    
    // Create navigation action
    createNavigationAction(menuId) {
        return {
            type: 'ir.actions.act_window',
            res_model: 'ir.ui.menu',
            view_mode: 'form',
            res_id: menuId,
            target: 'current'
        };
    }
}

// Register the service
registry.category("services").add("quickActions", {
    start() {
        return new QuickActionsService();
    }
});

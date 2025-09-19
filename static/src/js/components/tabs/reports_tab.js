/** @odoo-module **/

import { Component } from "@odoo/owl";

export class ReportsTab extends Component {
    static template = "farm_management_dashboard.ReportsTabTemplate";
    static props = {
        data: Object,
        filters: Object,
        userPermissions: Object,
        onFiltersChange: Function,
    };
}


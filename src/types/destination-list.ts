export interface DestinationList {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    // UI/Joined fields
    color?: string;
    icon?: string;
    status?: string;
    group_ids?: string[];
}

export interface DestinationListGroup {
    list_id: string;
    group_id: string;
    created_at?: string;
}

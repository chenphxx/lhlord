export type Cardinality = "one" | "many";
export type RelationDirection = "outgoing" | "incoming";


export interface EntityTypeDefinition
{
    id: string;
    name: string;
    group: string;
    group_name: string;
    default_icon: string;
    icons: string[];
}


export interface RelationPreset
{
    key: string;
    source_type: string;
    target_type: string;
    label: string;
    inverse_label: string;
    cardinality: Cardinality;
}


export interface Catalog
{
    version: number;
    types: EntityTypeDefinition[];
    relation_presets: RelationPreset[];
}


export interface CustomField
{
    key: string;
    value: string;
}


export interface RelatedCard
{
    id: string;
    card_type: string;
    name: string;
    icon: string;
}


export interface CardRelation
{
    id: string;
    preset_key: string | null;
    label: string;
    inverse_label: string;
    direction: RelationDirection;
    cardinality: Cardinality;
    related_card: RelatedCard;
}


export interface Card
{
    id: string;
    card_type: string;
    name: string;
    icon: string;
    summary: string;
    custom_fields: CustomField[];
    relations: CardRelation[];
    created_at: string;
    updated_at: string;
}


export interface LinkedCardDraft
{
    card_type: string;
    name: string;
    icon: string;
    summary: string;
    custom_fields: CustomField[];
}


export interface RelationInput
{
    preset_key?: string;
    target_card_id?: string;
    new_target?: LinkedCardDraft;
    target_type?: string;
    label?: string;
    inverse_label?: string;
}


export interface CardWritePayload
{
    card_type?: string;
    name?: string;
    icon?: string;
    summary?: string;
    custom_fields?: CustomField[];
    relations?: RelationInput[];
}

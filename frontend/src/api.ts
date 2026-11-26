import type {
    Card,
    CardTypeSchema,
    CardWritePayload,
    Catalog,
    StatsSummary,
    VisitorStats
} from "./types";


class ApiError extends Error
{
    status: number;


    constructor(
        message: string,
        status: number
    )
    {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}


function extractErrorDetail(payload: unknown): string
{
    if
    (
        payload
        && typeof payload === "object"
        && "detail" in payload
    )
    {
        const detail = (payload as { detail: unknown }).detail;
        if (typeof detail === "string")
        {
            return detail;
        }
        if (Array.isArray(detail))
        {
            const messages = detail
                .map
                (
                    (item) =>
                    {
                        if
                        (
                            item
                            && typeof item === "object"
                            && "msg" in item
                        )
                        {
                            return String((item as { msg: unknown }).msg);
                        }
                        return "";
                    }
                )
                .filter(Boolean);
            if (messages.length)
            {
                return messages.join("；");
            }
        }
    }

    return "请求失败，请稍后重试";
}


async function throwResponseError(response: Response): Promise<never>
{
    let payload: unknown = null;
    try
    {
        payload = await response.json();
    }
    catch
    {
        payload = null;
    }
    throw new ApiError(
        extractErrorDetail(payload),
        response.status
    );
}


async function request<T>
(
    path: string,
    init?: RequestInit
): Promise<T>
{
    let response: Response;
    try
    {
        response = await fetch
        (
            path,
            {
                ...init,
                headers: {
                    "Content-Type": "application/json",
                    ...init?.headers
                }
            }
        );
    }
    catch
    {
        throw new ApiError(
            "无法连接后端服务，请确认 FastAPI 已在 7100 端口运行",
            0
        );
    }

    if (!response.ok)
    {
        await throwResponseError(response);
    }

    if (response.status === 204)
    {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}


export interface ArchiveImportResult
{
    imported_cards: number;
    imported_relations: number;
    nav_layout: {
        primary: string[];
        other: string[];
    } | null;
}


export async function exportCatalog
(
    navLayout: {
        primary: string[];
        other: string[];
    }
): Promise<Blob>
{
    let response: Response;
    try
    {
        response = await fetch
        (
            "/api/export",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nav_layout: navLayout
                })
            }
        );
    }
    catch
    {
        throw new ApiError(
            "无法连接后端服务，数据导出失败",
            0
        );
    }

    if (!response.ok)
    {
        await throwResponseError(response);
    }
    return response.blob();
}


export async function importCatalog
(
    file: File
): Promise<ArchiveImportResult>
{
    let response: Response;
    try
    {
        response = await fetch
        (
            "/api/import",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/zip"
                },
                body: await file.arrayBuffer()
            }
        );
    }
    catch
    {
        throw new ApiError(
            "无法连接后端服务，数据导入失败",
            0
        );
    }

    if (!response.ok)
    {
        await throwResponseError(response);
    }
    return response.json() as Promise<ArchiveImportResult>;
}


export async function getCatalog(): Promise<Catalog>
{
    return request<Catalog>("/api/catalog");
}


export async function getStats
(
    operationLimit = 30
): Promise<StatsSummary>
{
    return request<StatsSummary>(
        `/api/stats?operation_limit=${operationLimit}`
    );
}


export async function recordVisit
(
    visitorId: string,
    cardType: string
): Promise<VisitorStats>
{
    return request<VisitorStats>(
        "/api/visits",
        {
            method: "POST",
            body: JSON.stringify(
                {
                    visitor_id: visitorId,
                    card_type: cardType
                }
            )
        }
    );
}


export async function getCards(cardType: string): Promise<Card[]>
{
    const payload = await request<{ items: Card[] }>(
        `/api/cards?type=${encodeURIComponent(cardType)}`
    );
    return payload.items;
}


export async function getCardTypeSchema
(
    cardType: string
): Promise<CardTypeSchema>
{
    return request<CardTypeSchema>(
        `/api/card-types/${encodeURIComponent(cardType)}/schema`
    );
}


export async function createCard
(
    payload: CardWritePayload & {
        card_type: string;
        name: string;
        icon: string;
    }
): Promise<Card>
{
    return request<Card>(
        "/api/cards",
        {
            method: "POST",
            body: JSON.stringify(payload)
        }
    );
}


export async function updateCard
(
    cardId: string,
    payload: CardWritePayload
): Promise<Card>
{
    return request<Card>(
        `/api/cards/${cardId}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload)
        }
    );
}


export async function deleteCard(cardId: string): Promise<void>
{
    await request<void>(
        `/api/cards/${cardId}`,
        {
            method: "DELETE"
        }
    );
}


export { ApiError };

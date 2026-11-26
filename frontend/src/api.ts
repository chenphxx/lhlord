import type {
    Card,
    CardWritePayload,
    Catalog
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

    if (response.status === 204)
    {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}


export async function getCatalog(): Promise<Catalog>
{
    return request<Catalog>("/api/catalog");
}


export async function getCards(cardType: string): Promise<Card[]>
{
    const payload = await request<{ items: Card[] }>(
        `/api/cards?type=${encodeURIComponent(cardType)}`
    );
    return payload.items;
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

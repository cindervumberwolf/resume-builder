from urllib.parse import urlparse, urlunparse, urlencode, parse_qs

STRIP_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "ref", "source", "mc_cid", "mc_eid",
}


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=False)
    filtered = {k: v for k, v in params.items() if k.lower() not in STRIP_PARAMS}
    clean_query = urlencode(filtered, doseq=True) if filtered else ""
    normalized = urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower().rstrip("."),
        parsed.path.rstrip("/") if parsed.path != "/" else "/",
        parsed.params,
        clean_query,
        "",  # drop fragment
    ))
    return normalized


def extract_domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def is_same_domain(url: str, domain: str) -> bool:
    url_domain = extract_domain(url)
    domain = domain.lower()
    return url_domain == domain or url_domain.endswith("." + domain)

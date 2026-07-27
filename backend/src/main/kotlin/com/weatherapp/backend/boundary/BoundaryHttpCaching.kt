package com.weatherapp.backend.boundary

import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.context.request.WebRequest
import java.time.Duration

/**
 * HTTP caching for the boundary endpoints.
 *
 * Powiat geometry is the most cacheable thing this backend serves: it is
 * identical for every user, it is measured in hundreds of kilobytes, and it
 * changes only when someone deliberately re-imports the PRG dataset. Without
 * caching, every map render re-downloads all of it.
 *
 * Two mechanisms, doing different jobs. `Cache-Control` lets a browser skip the
 * request entirely for a day. The `ETag` covers the rest: after that day, and
 * for any shared cache in between, a revalidation returns 304 with no body
 * rather than the geometry again.
 *
 * The tag combines the dataset version with what was asked for, so two
 * different code lists cannot collide on one tag - a subtle way to serve the
 * wrong polygons to the right URL.
 */
object BoundaryHttpCaching {

    private val CACHE_CONTROL: CacheControl =
        CacheControl.maxAge(Duration.ofDays(1))
            // Public: these endpoints are unauthenticated and the response
            // depends on nothing about the caller, so a shared cache may hold
            // one copy for everyone.
            .cachePublic()
            // A day-old boundary is still a correct boundary. Serving it while
            // revalidating keeps a map instant after an import rather than
            // stalling it on a re-download.
            .staleWhileRevalidate(Duration.ofDays(7))

    /**
     * Answers a conditional request, or returns null to mean "carry on and
     * build the body".
     *
     * Returns 304 when the client already holds this exact version. Spring
     * writes the ETag onto the response as part of [WebRequest.checkNotModified],
     * so the header is set on both paths.
     */
    fun <T : Any> notModified(request: WebRequest, version: String?, discriminator: String): ResponseEntity<T>? {
        // Nothing imported yet: no version exists, so nothing may be cached.
        // Skipping this check would let a client cache an empty map forever.
        if (version == null) return null

        return if (request.checkNotModified(tag(version, discriminator))) {
            ResponseEntity.status(304).cacheControl(CACHE_CONTROL).build()
        } else {
            null
        }
    }

    fun <T : Any> cacheable(body: T, version: String?): ResponseEntity<T> =
        ResponseEntity.ok()
            .cacheControl(if (version == null) CacheControl.noStore() else CACHE_CONTROL)
            .body(body)

    private fun tag(version: String, discriminator: String): String =
        "\"$version-${discriminator.hashCode().toUInt().toString(16)}\""
}

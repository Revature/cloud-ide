FROM openresty/openresty:alpine-fat

# Necessary openresty packages
RUN opm get c64bob/lua-resty-aes
RUN opm get ledgetech/lua-resty-http
RUN opm get SkyLothar/lua-resty-jwt

# Copy nginx configuration
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Expose the port
EXPOSE 8020

# Command to run
CMD ["/usr/local/openresty/bin/openresty", "-g", "daemon off;"]